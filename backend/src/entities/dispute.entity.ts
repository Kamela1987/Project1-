import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Trip } from './trip.entity';

export enum DisputeStatus {
  OPEN = 'open',
  RESOLVED = 'resolved',
}

/** Raised by either party on a trip (fare disagreement, no-show, safety concern, etc.), resolved by an admin. */
@Entity('disputes')
export class Dispute {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Trip)
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @Column({ name: 'trip_id' })
  tripId: string;

  @Column('uuid', { name: 'raised_by_user_id' })
  raisedByUserId: string;

  @Column()
  reason: string;

  @Column({ type: 'enum', enum: DisputeStatus, default: DisputeStatus.OPEN })
  status: DisputeStatus;

  @Column({ nullable: true })
  resolutionNote?: string;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt?: Date;
}
