import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum UserRole {
  RIDER = 'rider',
  DRIVER = 'driver',
  ADMIN = 'admin',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  phoneNumber: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.RIDER })
  role: UserRole;

  /**
   * Referral program (Phase 4). Every user gets one at creation
   * (ReferralsService.generateUniqueCode) — nullable at the DB level only
   * because pre-existing rows and out-of-band-created admins
   * (scripts/create-admin.ts) never get one, not because the app ever
   * creates a new user without it.
   */
  @Column('varchar', { unique: true, nullable: true })
  referralCode?: string | null;

  /** Set once at signup if a valid referralCode was supplied — see AuthService.verifyOtp. No FK, same denormalized-reference style as Payment.driverId/riderId. */
  @Column('uuid', { name: 'referred_by_user_id', nullable: true })
  referredByUserId?: string | null;

  /**
   * Accrued reward for referrals *this* user made, credited by
   * ReferralsService.rewardReferrerForFirstTrip when someone they referred
   * completes their first trip. Deliberately not the driver Wallet system
   * (that's keyed to driverId only, and a referrer is typically a rider) —
   * a separate, simpler balance. Not yet auto-applied as a fare discount;
   * see backend/README.md's "Referral program" for what redemption looks
   * like today (informational + admin-settleable, same as it was for
   * driver commission before payout automation).
   */
  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  referralCreditBalance: string;

  @CreateDateColumn()
  createdAt: Date;
}
