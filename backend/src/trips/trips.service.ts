import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trip, TripStatus } from '../entities/trip.entity';
import { TripStatusEvent } from '../entities/trip-status-event.entity';
import { PaymentMethod } from '../entities/payment-method.enum';
import { DriversService } from '../drivers/drivers.service';
import { UsersService } from '../users/users.service';
import { PaymentsService } from '../payments/payments.service';
import { haversineKm } from '../common/geo.util';
import { RequestTripDto } from './dto/request-trip.dto';
import { CompleteTripDto } from './dto/complete-trip.dto';

/**
 * Phase 1 status machine: requested -> accepted -> arrived -> in_progress -> completed
 * (or -> cancelled from requested/accepted). No live location tracking or
 * geo-radius matching yet — see docs/MONZE_RIDE_ARCHITECTURE.md §6-7 for the
 * full flow this is the first slice of.
 */
@Injectable()
export class TripsService {
  constructor(
    @InjectRepository(Trip) private readonly trips: Repository<Trip>,
    @InjectRepository(TripStatusEvent) private readonly events: Repository<TripStatusEvent>,
    private readonly driversService: DriversService,
    private readonly usersService: UsersService,
    private readonly paymentsService: PaymentsService,
  ) {}

  async request(riderId: string, dto: RequestTripDto): Promise<Trip> {
    const trip = this.trips.create({
      riderId,
      status: TripStatus.REQUESTED,
      ...dto,
    });
    const saved = await this.trips.save(trip);
    await this.recordEvent(saved.id, TripStatus.REQUESTED);
    return saved;
  }

  /**
   * All open requests a driver can currently offer to accept. When the
   * driver's own last-known position is available (see
   * realtime/location.gateway.ts's idle `driver:location` ping), sorts by
   * distance to each pickup instead of request time — closer trips first,
   * per docs/MONZE_RIDE_ARCHITECTURE.md §7. Never filters trips out just
   * because they're far away; a driver should always be able to see every
   * open request, just in a more useful order.
   */
  async listAvailable(driverLat?: number, driverLng?: number): Promise<(Trip & { distanceKm?: number })[]> {
    const trips = await this.trips.find({
      where: { status: TripStatus.REQUESTED },
      order: { requestedAt: 'ASC' },
    });

    if (driverLat === undefined || driverLng === undefined) {
      return trips;
    }

    return trips
      .map((trip) => ({
        ...trip,
        distanceKm: haversineKm(driverLat, driverLng, trip.pickupLat, trip.pickupLng),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }

  async listMine(riderId: string): Promise<Trip[]> {
    return this.trips.find({ where: { riderId }, order: { requestedAt: 'DESC' } });
  }

  /** Admin's live-monitoring feed — every trip, optionally filtered by status. */
  async listAll(status?: TripStatus): Promise<Trip[]> {
    return this.trips.find({
      where: status ? { status } : {},
      order: { requestedAt: 'DESC' },
      take: 200,
    });
  }

  async findById(id: string): Promise<Trip> {
    const trip = await this.trips.findOneBy({ id });
    if (!trip) {
      throw new NotFoundException('Trip not found');
    }
    return trip;
  }

  async accept(tripId: string, driverUserId: string): Promise<Trip> {
    const driver = await this.driversService.getByUserId(driverUserId);
    const trip = await this.requireStatus(tripId, TripStatus.REQUESTED);
    trip.driverId = driver.id;
    trip.status = TripStatus.ACCEPTED;
    const saved = await this.trips.save(trip);
    await this.recordEvent(tripId, TripStatus.ACCEPTED);
    return saved;
  }

  async markArrived(tripId: string, driverUserId: string): Promise<Trip> {
    const trip = await this.requireDriverOwnsTrip(tripId, driverUserId, TripStatus.ACCEPTED);
    trip.status = TripStatus.ARRIVED;
    const saved = await this.trips.save(trip);
    await this.recordEvent(tripId, TripStatus.ARRIVED);
    return saved;
  }

  async start(tripId: string, driverUserId: string): Promise<Trip> {
    const trip = await this.requireDriverOwnsTrip(tripId, driverUserId, TripStatus.ARRIVED);
    trip.status = TripStatus.IN_PROGRESS;
    const saved = await this.trips.save(trip);
    await this.recordEvent(tripId, TripStatus.IN_PROGRESS);
    return saved;
  }

  async complete(tripId: string, driverUserId: string, dto: CompleteTripDto): Promise<Trip> {
    const driver = await this.driversService.getByUserId(driverUserId);
    const trip = await this.requireStatus(tripId, TripStatus.IN_PROGRESS);
    if (trip.driverId !== driver.id) {
      throw new ForbiddenException('This trip is not assigned to you');
    }

    trip.status = TripStatus.COMPLETED;
    trip.fareAmount = dto.fareAmount.toFixed(2);
    trip.completedAt = new Date();
    const saved = await this.trips.save(trip);
    await this.recordEvent(tripId, TripStatus.COMPLETED);

    // Rider can switch payment method at the door (dto.paymentMethod);
    // otherwise honor what they requested with.
    const paymentMethod = dto.paymentMethod ?? trip.paymentMethod;

    if (paymentMethod === PaymentMethod.CASH) {
      // Settled immediately: driver already has the cash, platform's
      // commission is recorded as a debt (see WalletService.applyTripCommission
      // and docs/MONZE_RIDE_ARCHITECTURE.md §10).
      await this.paymentsService.recordCashPayment(
        tripId,
        driver.id,
        trip.riderId,
        dto.fareAmount,
        driver.vehicle?.type,
      );
    } else {
      // Mobile money: trip is over, but payment settles asynchronously —
      // see PaymentsService.initiateMobileMoneyPayment and the
      // /payments/webhooks/* callback that resolves it.
      const rider = await this.usersService.findById(trip.riderId);
      await this.paymentsService.initiateMobileMoneyPayment(
        tripId,
        driver.id,
        trip.riderId,
        rider.phoneNumber,
        dto.fareAmount,
        paymentMethod,
      );
    }

    return saved;
  }

  async cancel(tripId: string, riderId: string): Promise<Trip> {
    const trip = await this.findById(tripId);
    if (trip.riderId !== riderId) {
      throw new ForbiddenException('Only the requesting rider can cancel this trip');
    }
    if (![TripStatus.REQUESTED, TripStatus.ACCEPTED].includes(trip.status)) {
      throw new BadRequestException(`Cannot cancel a trip in status ${trip.status}`);
    }
    trip.status = TripStatus.CANCELLED;
    const saved = await this.trips.save(trip);
    await this.recordEvent(tripId, TripStatus.CANCELLED);
    return saved;
  }

  private async requireStatus(tripId: string, expected: TripStatus): Promise<Trip> {
    const trip = await this.findById(tripId);
    if (trip.status !== expected) {
      throw new BadRequestException(`Trip must be ${expected}, but is ${trip.status}`);
    }
    return trip;
  }

  private async requireDriverOwnsTrip(
    tripId: string,
    driverUserId: string,
    expectedStatus: TripStatus,
  ): Promise<Trip> {
    const driver = await this.driversService.getByUserId(driverUserId);
    const trip = await this.requireStatus(tripId, expectedStatus);
    if (trip.driverId !== driver.id) {
      throw new ForbiddenException('This trip is not assigned to you');
    }
    return trip;
  }

  private async recordEvent(tripId: string, status: TripStatus): Promise<void> {
    await this.events.save(this.events.create({ tripId, status }));
  }
}
