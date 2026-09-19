import { randomBytes } from 'crypto';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { ReferralReward } from '../entities/referral-reward.entity';
import { DEFAULT_REFERRAL_REWARD_AMOUNT, REFERRAL_REWARD_AMOUNT_ENV } from '../config/referral.config';

const MAX_CODE_GENERATION_ATTEMPTS = 5;

@Injectable()
export class ReferralsService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(ReferralReward) private readonly rewards: Repository<ReferralReward>,
    private readonly config: ConfigService,
  ) {}

  /** Called once per new user at signup (AuthService.verifyOtp) — an 8-char code, retried on the astronomically rare collision. */
  async generateUniqueCode(): Promise<string> {
    for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt++) {
      const code = randomBytes(4).toString('hex').toUpperCase();
      const existing = await this.users.findOneBy({ referralCode: code });
      if (!existing) {
        return code;
      }
    }
    throw new Error('Could not generate a unique referral code');
  }

  /** `undefined`/empty → no referrer, not an error (most signups have none). An actually-supplied but unknown code is a mistake worth surfacing to the signer-upper, not silently dropping. */
  async resolveReferrer(code?: string): Promise<User | null> {
    if (!code) {
      return null;
    }
    const referrer = await this.users.findOneBy({ referralCode: code });
    if (!referrer) {
      throw new BadRequestException('Invalid referral code');
    }
    return referrer;
  }

  /**
   * Credits the referrer once — called from TripsService.complete() only
   * when this trip is confirmed to be the rider's first-ever completed
   * one, so this naturally never double-fires for the same rider. A
   * no-op if the rider wasn't referred by anyone. Fires on trip
   * completion regardless of eventual mobile-money payment outcome
   * (settled asynchronously, possibly after this) — a deliberate
   * simplification, see backend/README.md's "Referral program".
   */
  async rewardReferrerForFirstTrip(riderId: string, tripId: string): Promise<void> {
    const rider = await this.users.findOneBy({ id: riderId });
    if (!rider?.referredByUserId) {
      return;
    }
    const amount = Number(this.config.get(REFERRAL_REWARD_AMOUNT_ENV, DEFAULT_REFERRAL_REWARD_AMOUNT));
    await this.rewards.save(
      this.rewards.create({
        referrerUserId: rider.referredByUserId,
        referredUserId: riderId,
        tripId,
        amount: amount.toFixed(2),
      }),
    );
    await this.users.increment({ id: rider.referredByUserId }, 'referralCreditBalance', amount);
  }

  /** Own referral code, accrued credit, and reward history — see GET /users/me/referrals. */
  async getMyReferrals(userId: string) {
    const user = await this.users.findOneBy({ id: userId });
    const [rewards, referredCount] = await Promise.all([
      this.rewards.find({ where: { referrerUserId: userId }, order: { createdAt: 'DESC' } }),
      this.users.count({ where: { referredByUserId: userId } }),
    ]);
    return {
      referralCode: user?.referralCode ?? null,
      referralCreditBalance: Number(user?.referralCreditBalance ?? 0),
      referredCount,
      rewards,
    };
  }
}
