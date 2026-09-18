import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Trip } from './trip.entity';

export enum PaymentMethod {
  CASH = 'cash',
  MOMO = 'momo',
  AIRTEL = 'airtel',
}

export enum PaymentStatus {
  PENDING = 'pending',
  COLLECTED = 'collected',
  FAILED = 'failed',
}

/** Phase 1 only supports `cash`, recorded by the driver at trip completion. */
@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Trip)
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @Column({ name: 'trip_id', unique: true })
  tripId: string;

  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.CASH })
  method: PaymentMethod;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: string;

  @CreateDateColumn()
  createdAt: Date;
}
