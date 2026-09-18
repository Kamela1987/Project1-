import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trip, TripStatus } from '../entities/trip.entity';
import { TripStatusEvent } from '../entities/trip-status-event.entity';
import { Payment, PaymentMethod, PaymentStatus } from '../entities/payment.entity';
import { DriversService } from '../drivers/drivers.service';
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
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    private readonly driversService: DriversService,
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

  /** All open requests a driver can currently offer to accept. */
  async listAvailable(): Promise<Trip[]> {
    return this.trips.find({
      where: { status: TripStatus.REQUESTED },
      order: { requestedAt: 'ASC' },
    });
  }

  async listMine(riderId: string): Promise<Trip[]> {
    return this.trips.find({ where: { riderId }, order: { requestedAt: 'DESC' } });
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
    const trip = await this.requireDriverOwnsTrip(tripId, driverUserId, TripStatus.IN_PROGRESS);
    trip.status = TripStatus.COMPLETED;
    trip.fareAmount = dto.fareAmount.toFixed(2);
    trip.completedAt = new Date();
    const saved = await this.trips.save(trip);
    await this.recordEvent(tripId, TripStatus.COMPLETED);

    const payment = this.payments.create({
      tripId,
      method: PaymentMethod.CASH,
      status: PaymentStatus.COLLECTED,
      amount: trip.fareAmount,
    });
    await this.payments.save(payment);

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
