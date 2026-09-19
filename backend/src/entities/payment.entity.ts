import { Column, CreateDateColumn, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Trip } from './trip.entity';
import { PaymentMethod, PaymentStatus } from './payment-method.enum';

export { PaymentMethod, PaymentStatus };

/**
 * Cash is recorded synchronously by the driver at trip completion.
 * Mobile money (`momo`/`airtel`) starts `pending` — the platform requests
 * payment from the rider's phone and a provider webhook (or, in dev mode,
 * a timer — see src/payments/) resolves it to `collected` or `failed`.
 */
@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Trip)
  @JoinColumn({ name: 'trip_id' })
  trip: Trip;

  @Column({ name: 'trip_id', unique: true })
  tripId: string;

  /** Denormalized so the async payment webhook can credit the right driver's wallet, and PaymentsController can authorize access, without re-deriving either from the trip. */
  @Column('uuid', { name: 'driver_id', nullable: true })
  driverId?: string;

  @Column('uuid', { name: 'rider_id', nullable: true })
  riderId?: string;

  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.CASH })
  method: PaymentMethod;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: string;

  /** MTN MoMo / Airtel Money transaction reference, once known. */
  @Column({ nullable: true })
  providerReference?: string;

  @CreateDateColumn()
  createdAt: Date;
}
