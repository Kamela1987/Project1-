import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/current-user.decorator';
import { UserRole } from '../entities/user.entity';
import { RequestPayoutDto } from './dto/request-payout.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Anyone authenticated can poll a payment by id today — fine for a
   * Phase 1/2 scaffold, but before production this should check the
   * caller is the trip's rider or driver rather than any logged-in user.
   */
  @Get(':id')
  findById(@Param('id') id: string) {
    return this.paymentsService.findById(id);
  }

  @Post('payout')
  @Roles(UserRole.DRIVER)
  requestPayout(@CurrentUser() user: AuthenticatedUser, @Body() dto: RequestPayoutDto) {
    return this.paymentsService.requestPayout(user.userId, dto);
  }
}
