import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Driver } from '../entities/driver.entity';
import { Trip, TripStatus } from '../entities/trip.entity';
import { haversineKm } from '../common/geo.util';
import { LocationService } from './location.service';
import { LocationGateway } from './location.gateway';

const OFFER_TIMEOUT_SECONDS = 15;

/**
 * Pushes a newly-requested trip to the single nearest online driver first,
 * instead of only relying on drivers pulling `GET /trips/available`
 * (which stays as-is — the fallback for a trip no one has been offered
 * yet, or that every offer expired on). If that driver doesn't respond
 * within OFFER_TIMEOUT_SECONDS (they neither accept via the existing
 * `PATCH /trips/:id/accept` nor explicitly decline), the offer cascades to
 * the next-nearest driver, and so on until the candidate pool (every
 * currently-online driver with a known position) is exhausted.
 *
 * This never touches the trip state machine itself — `accept()` is
 * unchanged, and any driver (offered or not) can still accept a trip that
 * shows up in their pull-based list. Declining or letting an offer expire
 * simply removes that driver from *this* trip's own cascade; it doesn't
 * affect their eligibility for any other trip.
 *
 * In-memory, single-process state (`offered`, per-trip candidate
 * exclusion) — correct for one backend instance, which is what this
 * project runs. A multi-instance deployment would need to move this to
 * Redis (e.g. a `dispatch:<tripId>:offered` set) so every instance sees
 * the same cascade state; that's future work, not needed at Monze's scale.
 */
@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);
  private readonly offeredDriverIds = new Map<string, Set<string>>();

  constructor(
    private readonly locationService: LocationService,
    private readonly gateway: LocationGateway,
    @InjectRepository(Driver) private readonly drivers: Repository<Driver>,
    @InjectRepository(Trip) private readonly trips: Repository<Trip>,
  ) {}

  /** Kicks off (or continues) a trip's offer cascade — call once when a trip is requested. */
  async offerToNearestDriver(trip: Trip): Promise<void> {
    const alreadyOffered = this.offeredDriverIds.get(trip.id) ?? new Set<string>();

    const locations = await this.locationService.listAllLocations();
    const candidates = locations
      .filter((loc) => !alreadyOffered.has(loc.driverId))
      .map((loc) => ({
        driverId: loc.driverId,
        distanceKm: haversineKm(loc.lat, loc.lng, trip.pickupLat, trip.pickupLng),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);

    if (!candidates.length) {
      // No one left to offer to — the trip stays REQUESTED and visible via
      // the pull-based GET /trips/available, exactly as it always was.
      this.offeredDriverIds.delete(trip.id);
      return;
    }

    const [nearest] = candidates;
    const driver = await this.drivers.findOneBy({ id: nearest.driverId });
    if (!driver || !driver.isOnline) {
      alreadyOffered.add(nearest.driverId);
      this.offeredDriverIds.set(trip.id, alreadyOffered);
      await this.offerToNearestDriver(trip);
      return;
    }

    alreadyOffered.add(nearest.driverId);
    this.offeredDriverIds.set(trip.id, alreadyOffered);

    this.gateway.server.to(this.gateway.driverRoom(driver.userId)).emit('trip:offer', {
      tripId: trip.id,
      pickupLat: trip.pickupLat,
      pickupLng: trip.pickupLng,
      pickupLandmark: trip.pickupLandmark ?? null,
      dropoffLat: trip.dropoffLat,
      dropoffLng: trip.dropoffLng,
      distanceKm: Math.round(nearest.distanceKm * 100) / 100,
      expiresInSeconds: OFFER_TIMEOUT_SECONDS,
    });

    setTimeout(() => {
      this.cascade(trip.id).catch((err) =>
        this.logger.error(`Dispatch cascade failed for trip ${trip.id}: ${(err as Error).message}`),
      );
    }, OFFER_TIMEOUT_SECONDS * 1000);
  }

  private async cascade(tripId: string): Promise<void> {
    const trip = await this.trips.findOneBy({ id: tripId });
    if (!trip || trip.status !== TripStatus.REQUESTED) {
      // Accepted (by the offered driver or anyone else via the pull list)
      // or cancelled in the meantime — nothing left for this trip to cascade to.
      this.offeredDriverIds.delete(tripId);
      return;
    }
    await this.offerToNearestDriver(trip);
  }
}
