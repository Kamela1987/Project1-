import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { Driver } from '../entities/driver.entity';
import { Trip, TripStatus } from '../entities/trip.entity';
import { LocationService } from './location.service';

const ACTIVE_TRIP_STATUSES = [TripStatus.ACCEPTED, TripStatus.ARRIVED, TripStatus.IN_PROGRESS];

/**
 * Phase 2 live tracking, extended for driver matching (§7): a driver
 * streams their position over `driver:location` both while idle (online,
 * no trip yet — this is what makes distance-sorted `GET /trips/available`
 * possible, see TripsService.listAvailable) and while on an active trip.
 * The rider — and the driver, for their own confirmation — join that
 * trip's room (`trip:subscribe`) to receive trip-scoped broadcasts. This
 * is additive to, not a replacement for, `GET /trips/:id/location` (see
 * trips.controller.ts), which stays as the offline/low-connectivity
 * fallback described in docs/MONZE_RIDE_ARCHITECTURE.md §6.4.
 */
@WebSocketGateway({ cors: { origin: '*' } })
export class LocationGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(LocationGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly locationService: LocationService,
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    @InjectRepository(Trip) private readonly trips: Repository<Trip>,
  ) {}

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const token = this.extractToken(socket);
      const payload = await this.jwtService.verifyAsync<{ sub: string; role: string }>(token);
      socket.data.userId = payload.sub;
      socket.data.role = payload.role;
    } catch (err) {
      this.logger.warn(`Rejected socket connection: ${(err as Error).message}`);
      socket.emit('error', 'Unauthorized');
      socket.disconnect(true);
    }
  }

  /** Rider or driver joins a trip's room to start receiving `driver:location` events for it. */
  @SubscribeMessage('trip:subscribe')
  async subscribe(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { tripId: string },
  ): Promise<void> {
    const trip = await this.trips.findOneBy({ id: body.tripId });
    if (!trip) {
      return;
    }

    const isRider = trip.riderId === socket.data.userId;
    const isDriver =
      socket.data.role === 'driver' && (await this.driverOwnsTrip(trip, socket.data.userId));
    if (!isRider && !isDriver) {
      socket.emit('error', 'Not a participant on this trip');
      return;
    }

    await socket.join(this.room(body.tripId));

    // Send the last known position immediately so a late joiner isn't
    // stuck waiting for the driver's next GPS ping.
    if (trip.driverId) {
      const location = await this.locationService.getLocation(trip.driverId);
      if (location) {
        socket.emit('driver:location', { tripId: trip.id, ...location });
      }
    }
  }

  /**
   * Driver reports a new position — either an idle ping (`tripId` omitted,
   * just online and available) or while actively working a trip. Idle
   * pings are what let `GET /trips/available` sort by distance to the
   * driver; only trip-scoped pings also broadcast to that trip's room.
   */
  @SubscribeMessage('driver:location')
  async updateLocation(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { tripId?: string; lat: number; lng: number },
  ): Promise<void> {
    if (socket.data.role !== 'driver') {
      return;
    }

    const driver = await this.drivers.findOneBy({ userId: socket.data.userId });
    if (!driver || !driver.isOnline) {
      return;
    }

    const location = await this.locationService.setLocation(driver.id, body.lat, body.lng);

    if (!body.tripId) {
      return;
    }

    const trip = await this.trips.findOneBy({ id: body.tripId });
    if (!trip || trip.driverId !== driver.id || !ACTIVE_TRIP_STATUSES.includes(trip.status)) {
      return;
    }
    this.server.to(this.room(body.tripId)).emit('driver:location', { tripId: body.tripId, ...location });
  }

  private async driverOwnsTrip(trip: Trip, userId: string): Promise<boolean> {
    const driver = await this.drivers.findOneBy({ userId });
    return !!driver && trip.driverId === driver.id;
  }

  private room(tripId: string): string {
    return `trip:${tripId}`;
  }

  private extractToken(socket: Socket): string {
    const token = socket.handshake.auth?.token ?? socket.handshake.query?.token;
    if (!token || typeof token !== 'string') {
      throw new UnauthorizedException('Missing token');
    }
    return token;
  }
}
