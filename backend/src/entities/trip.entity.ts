import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Driver } from './driver.entity';
import { VehicleType } from './vehicle.entity';

export enum TripStatus {
  REQUESTED = 'requested',
  ACCEPTED = 'accepted',
  ARRIVED = 'arrived',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

/**
 * Phase 1: pickup/dropoff are plain lat/lng + a free-text landmark note,
 * since Monze lacks formal street addressing (see architecture doc §1).
 * A PostGIS `geography` column and radius-based matching land in Phase 2+
 * once the driver pool is large enough to need it (see architecture doc §7).
 */
@Entity('trips')
export class Trip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'rider_id' })
  rider: User;

  @Column({ name: 'rider_id' })
  riderId: string;

  @ManyToOne(() => Driver, { nullable: true })
  @JoinColumn({ name: 'driver_id' })
  driver?: Driver;

  @Column({ name: 'driver_id', nullable: true })
  driverId?: string;

  @Column('double precision')
  pickupLat: number;

  @Column('double precision')
  pickupLng: number;

  @Column({ nullable: true })
  pickupLandmark?: string;

  @Column('double precision')
  dropoffLat: number;

  @Column('double precision')
  dropoffLng: number;

  @Column({ nullable: true })
  dropoffLandmark?: string;

  /**
   * Rider's vehicle preference (car, minibus, or motorbike). Nullable means
   * "any" — useful for riders who just want the fastest/cheapest match.
   * Motorbikes are typically cheaper and faster through town traffic, so
   * this lets riders opt into that tradeoff explicitly.
   */
  @Column({ type: 'enum', enum: VehicleType, nullable: true })
  requestedVehicleType?: VehicleType;

  @Column({ type: 'enum', enum: TripStatus, default: TripStatus.REQUESTED })
  status: TripStatus;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  fareAmount?: string;

  @CreateDateColumn()
  requestedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  completedAt?: Date;
}
