import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { ReferralReward } from '../entities/referral-reward.entity';
import { ReferralsService } from './referrals.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, ReferralReward])],
  providers: [ReferralsService],
  exports: [ReferralsService],
})
export class ReferralsModule {}
