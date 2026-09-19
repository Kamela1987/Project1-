import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from './redis.provider';

export interface DriverLocation {
  lat: number;
  lng: number;
  updatedAt: string;
}

/**
 * A driver's live position is a fast-changing, ephemeral value — not
 * something worth a Postgres write on every GPS ping — so it lives only
 * in Redis with a short TTL. If a driver's app crashes or loses signal,
 * their last-known position simply expires instead of going stale forever.
 */
const LOCATION_TTL_SECONDS = 60;

@Injectable()
export class LocationService implements OnModuleDestroy {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /** Closes the ioredis connection when the app shuts down — otherwise it's an open handle Node (and Jest, in e2e runs) waits on. */
  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  async setLocation(driverId: string, lat: number, lng: number): Promise<DriverLocation> {
    const location: DriverLocation = { lat, lng, updatedAt: new Date().toISOString() };
    await this.redis.set(this.key(driverId), JSON.stringify(location), 'EX', LOCATION_TTL_SECONDS);
    return location;
  }

  async getLocation(driverId: string): Promise<DriverLocation | null> {
    const raw = await this.redis.get(this.key(driverId));
    return raw ? (JSON.parse(raw) as DriverLocation) : null;
  }

  /** Called when a driver goes offline so a stale position can't keep influencing distance sorting. */
  async clearLocation(driverId: string): Promise<void> {
    await this.redis.del(this.key(driverId));
  }

  /**
   * Every online driver's last-known position — the candidate pool
   * DispatchService offers a new trip request to, nearest first. A plain
   * `KEYS` scan is fine at Monze's scale (this key space is bounded by
   * "drivers currently online", not total drivers ever); a deployment
   * with enough concurrent online drivers to make that costly would
   * reach for a Redis geo set (`GEOADD`/`GEOSEARCH`) instead.
   */
  async listAllLocations(): Promise<(DriverLocation & { driverId: string })[]> {
    const keys = await this.redis.keys('driver:location:*');
    if (!keys.length) {
      return [];
    }
    const values = await this.redis.mget(...keys);
    return keys
      .map((key, i) => {
        const raw = values[i];
        if (!raw) return null;
        const driverId = key.slice('driver:location:'.length);
        return { driverId, ...(JSON.parse(raw) as DriverLocation) };
      })
      .filter((v): v is DriverLocation & { driverId: string } => v !== null);
  }

  private key(driverId: string): string {
    return `driver:location:${driverId}`;
  }
}
