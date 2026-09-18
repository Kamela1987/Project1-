import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Trip, TripStatus } from './trip.entity';

/** Append-only audit trail of every status transition a trip goes through. */
@Entity('trip_status_events')
export class TripStatusEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Trip, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @Column({ name: 'trip_id' })
  tripId: string;

  @Column({ type: 'enum', enum: TripStatus })
  status: TripStatus;

  @CreateDateColumn()
  occurredAt: Date;
}
