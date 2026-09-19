import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trip, TripStatus } from '../entities/trip.entity';
import { TripStatusEvent } from '../entities/trip-status-event.entity';
import { PaymentMethod } from '../entities/payment-method.enum';
import { DriversService } from '../drivers/drivers.service';
import { UsersService } from '../users/users.service';
import { PaymentsService } from '../payments/payments.service';
import { ZonesService } from '../zones/zones.service';
import { FareRulesService } from '../fare-rules/fare-rules.service';
import { TownsService } from '../towns/towns.service';
import { ReferralsService } from '../referrals/referrals.service';
import { DispatchService } from '../realtime/dispatch.service';
import { VehicleType } from '../entities/vehicle.entity';
import { haversineKm } from '../common/geo.util';
import { RequestTripDto } from './dto/request-trip.dto';
import { CompleteTripDto } from './dto/complete-trip.dto';
import { FareEstimateDto } from './dto/fare-estimate.dto';

/**
 * No routing/traffic API is wired up (that's future work, separate from
 * zone pricing) — duration is approximated from haversine distance at a
 * flat assumed town-driving speed. Good enough for a fare *estimate*
 * ballpark, not for an ETA claim.
 */
const ASSUMED_AVG_SPEED_KMH = 25;

export interface FareEstimateLine {
  vehicleType: VehicleType;
  fare: number;
}

export interface FareEstimateResult {
  zoneId: string | null;
  zoneName: string | null;
  distanceKm: number;
  estDurationMin: number;
  estimates: FareEstimateLine[];
}

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
    private readonly zonesService: ZonesService,
    private readonly fareRulesService: FareRulesService,
    private readonly townsService: TownsService,
    private readonly referralsService: ReferralsService,
    private readonly dispatchService: DispatchService,
  ) {}

  /**
   * Fare formula from docs/MONZE_RIDE_ARCHITECTURE.md §6.3:
   * base_fare + distance_km * per_km_rate + est_duration_min * per_min_rate,
   * rated per zone + vehicle type. The pickup point's zone is found via
   * PostGIS point-in-polygon (ZonesService.findContainingPoint) — a pickup
   * outside every configured zone boundary returns `zoneId: null` and no
   * estimates, not an error, since not every zone need have a boundary
   * drawn yet (see Zone.boundary's comment).
   *
   * This never touches trip completion (TripsService.complete still takes
   * a driver-entered fareAmount) — cash fares are agreed in person and can
   * legitimately differ from the estimate (detours, waiting time, haggling).
   * This is purely the rider-facing "what will this roughly cost" step
   * before requesting, same as any ride-hailing app's fare estimate screen.
   */
  async estimateFare(dto: FareEstimateDto): Promise<FareEstimateResult> {
    const zone = await this.zonesService.findContainingPoint(dto.pickupLat, dto.pickupLng);
    const distanceKm = haversineKm(dto.pickupLat, dto.pickupLng, dto.dropoffLat, dto.dropoffLng);
    const estDurationMin = (distanceKm / ASSUMED_AVG_SPEED_KMH) * 60;

    if (!zone) {
      return { zoneId: null, zoneName: null, distanceKm, estDurationMin, estimates: [] };
    }

    const vehicleTypes = dto.vehicleType ? [dto.vehicleType] : Object.values(VehicleType);
    const estimates: FareEstimateLine[] = [];
    for (const vehicleType of vehicleTypes) {
      const rule = await this.fareRulesService.findOne(zone.id, vehicleType);
      if (!rule) continue; // no rate card for this vehicle type in this zone yet
      const fare =
        Number(rule.baseFare) + distanceKm * Number(rule.perKmRate) + estDurationMin * Number(rule.perMinRate);
      estimates.push({ vehicleType, fare: Math.round(fare * 100) / 100 });
    }

    return { zoneId: zone.id, zoneName: zone.name, distanceKm, estDurationMin, estimates };
  }

  /**
   * Tags the trip with its pickup's town (multi-town support, Phase 4),
   * computed once here and cached on the row — see Trip.townId's comment.
   * A pickup outside every configured town boundary (or no towns
   * configured at all, e.g. a single-town Monze deployment) gets `null`,
   * which `listAvailable` treats as visible to every driver — this never
   * makes an existing single-town setup behave any differently.
   */
  async request(riderId: string, dto: RequestTripDto): Promise<Trip> {
    const town = await this.townsService.findContainingPoint(dto.pickupLat, dto.pickupLng);
    const trip = this.trips.create({
      riderId,
      status: TripStatus.REQUESTED,
      townId: town?.id ?? null,
      ...dto,
    });
    const saved = await this.trips.save(trip);
    await this.recordEvent(saved.id, TripStatus.REQUESTED);
    await this.dispatchService.offerToNearestDriver(saved);
    return saved;
  }

  /**
   * All open requests a driver can currently offer to accept. When the
   * driver's own last-known position is available (see
   * realtime/location.gateway.ts's idle `driver:location` ping):
   *  - Scoped to the driver's own town (multi-town support, Phase 4): a
   *    driver in one town never sees another town's requests, found the
   *    same way a trip's own town was tagged (TownsService.findContainingPoint
   *    on the driver's position). A driver outside every configured town,
   *    or a trip with no town tag (see Trip.townId), is never filtered
   *    out by this — only trips confidently placed in a *different* town
   *    are hidden, so a deployment with no towns configured is completely
   *    unaffected.
   *  - Sorted by distance to each pickup instead of request time — closer
   *    trips first, per docs/MONZE_RIDE_ARCHITECTURE.md §7.
   * Distance-sorting never filters trips out just because they're far
   * away; only the town scoping above ever removes a trip from the list.
   */
  async listAvailable(driverLat?: number, driverLng?: number): Promise<(Trip & { distanceKm?: number })[]> {
    let trips = await this.trips.find({
      where: { status: TripStatus.REQUESTED },
      order: { requestedAt: 'ASC' },
    });

    if (driverLat === undefined || driverLng === undefined) {
      return trips;
    }

    const driverTown = await this.townsService.findContainingPoint(driverLat, driverLng);
    if (driverTown) {
      trips = trips.filter((trip) => trip.townId === null || trip.townId === driverTown.id);
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

  /** Admin's live-monitoring feed — every trip, optionally filtered by status and/or town. */
  async listAll(status?: TripStatus, townId?: string): Promise<Trip[]> {
    return this.trips.find({
      where: { ...(status ? { status } : {}), ...(townId ? { townId } : {}) },
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

    // Referral reward (Phase 4): fires exactly once per rider, ever — this
    // count includes the trip just saved above, so ===1 means it's their
    // first completed trip. A no-op inside rewardReferrerForFirstTrip if
    // they weren't referred by anyone.
    const completedTripCount = await this.trips.count({
      where: { riderId: trip.riderId, status: TripStatus.COMPLETED },
    });
    if (completedTripCount === 1) {
      await this.referralsService.rewardReferrerForFirstTrip(trip.riderId, tripId);
    }

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
