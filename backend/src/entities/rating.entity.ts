import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Trip } from './trip.entity';

/**
 * One rating per completed trip, submitted by the rider. `driverId` and
 * `riderId` are denormalized from Trip (same pattern as Payment.driverId)
 * so the driver-aggregate query doesn't need a join.
 */
@Entity('ratings')
export class Rating {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Trip)
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  /** unique: the real "once per trip" guard, enforced at the DB level. */
  @Column({ name: 'trip_id', unique: true })
  tripId: string;

  @Column('uuid', { name: 'driver_id' })
  driverId: string;

  @Column('uuid', { name: 'rider_id' })
  riderId: string;

  @Column('int')
  stars: number;

  @Column({ nullable: true })
  comment?: string;

  @CreateDateColumn()
  createdAt: Date;
}
