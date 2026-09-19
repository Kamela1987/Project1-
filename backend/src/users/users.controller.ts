import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthenticatedUser } from '../common/current-user.decorator';
import { ReferralsService } from '../referrals/referrals.service';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly referralsService: ReferralsService,
  ) {}

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findById(user.userId);
  }

  /** Own referral code, accrued credit, and reward history. */
  @Get('me/referrals')
  myReferrals(@CurrentUser() user: AuthenticatedUser) {
    return this.referralsService.getMyReferrals(user.userId);
  }
}
