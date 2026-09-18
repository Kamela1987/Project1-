import { Inject, Injectable } from '@nestjs/common';
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
export class LocationService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async setLocation(driverId: string, lat: number, lng: number): Promise<DriverLocation> {
    const location: DriverLocation = { lat, lng, updatedAt: new Date().toISOString() };
    await this.redis.set(this.key(driverId), JSON.stringify(location), 'EX', LOCATION_TTL_SECONDS);
    return location;
  }

  async getLocation(driverId: string): Promise<DriverLocation | null> {
    const raw = await this.redis.get(this.key(driverId));
    return raw ? (JSON.parse(raw) as DriverLocation) : null;
  }

  private key(driverId: string): string {
    return `driver:location:${driverId}`;
  }
}
