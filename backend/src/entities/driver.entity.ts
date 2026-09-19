import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { User } from './user.entity';
import { Vehicle } from './vehicle.entity';
import { PaymentMethod } from './payment-method.enum';

export enum DriverVerificationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

/**
 * Phase 1 note: `isOnline` is a simple flag, not a live-tracked position.
 * Live GPS location tracking is Phase 2 (see docs/MONZE_RIDE_ARCHITECTURE.md).
 */
@Entity('drivers')
export class Driver {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', unique: true })
  userId: string;

  @Column({ unique: true })
  licenseNumber: string;

  @Column({
    type: 'enum',
    enum: DriverVerificationStatus,
    default: DriverVerificationStatus.PENDING,
  })
  verificationStatus: DriverVerificationStatus;

  @Column({ default: false })
  isOnline: boolean;

  /** Opts into PaymentsService.runAutoPayouts sweeping their wallet balance out automatically — see PATCH /drivers/me/payout-settings. */
  @Column({ default: false })
  autoPayoutEnabled: boolean;

  /** Required to enable autoPayoutEnabled (which provider to disburse to); optional otherwise — the on-demand `POST /payments/payout` flow always takes its own explicit method. */
  @Column({ type: 'enum', enum: PaymentMethod, nullable: true })
  payoutMethod?: PaymentMethod;

  @OneToOne(() => Vehicle, (vehicle) => vehicle.driver, { nullable: true })
  vehicle?: Vehicle;
}
