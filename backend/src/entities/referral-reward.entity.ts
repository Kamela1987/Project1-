import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Append-only record of a referral payout — one row per rewarded referral,
 * mirroring LedgerEntry's audit-trail role but kept separate from the
 * driver-only Wallet/LedgerEntry system (see User.referralCreditBalance's
 * comment for why). Plain typed columns, no FK constraints, same
 * denormalized-reference style as Payment.driverId/riderId.
 */
@Entity('referral_rewards')
export class ReferralReward {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'referrer_user_id' })
  referrerUserId: string;

  @Column('uuid', { name: 'referred_user_id' })
  referredUserId: string;

  @Column('uuid', { name: 'trip_id' })
  tripId: string;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: string;

  @CreateDateColumn()
  createdAt: Date;
}
