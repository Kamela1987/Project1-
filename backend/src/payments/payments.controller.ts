import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/current-user.decorator';
import { UserRole } from '../entities/user.entity';
import { DriversService } from '../drivers/drivers.service';
import { RequestPayoutDto } from './dto/request-payout.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly driversService: DriversService,
  ) {}

  /** Only the trip's rider/driver, or an admin, can view its payment. */
  @Get(':id')
  async findById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const payment = await this.paymentsService.findById(id);
    if (user.role !== UserRole.ADMIN && payment.riderId !== user.userId) {
      let isDriver = false;
      if (user.role === UserRole.DRIVER && payment.driverId) {
        const driver = await this.driversService.getByUserId(user.userId);
        isDriver = driver.id === payment.driverId;
      }
      if (!isDriver) {
        throw new ForbiddenException('Not a participant on this payment');
      }
    }
    return payment;
  }

  @Post('payout')
  @Roles(UserRole.DRIVER)
  requestPayout(@CurrentUser() user: AuthenticatedUser, @Body() dto: RequestPayoutDto) {
    return this.paymentsService.requestPayout(user.userId, dto);
  }

  /** Runs the same sweep PayoutSchedulerService's cron job runs, on demand — an ops escape hatch (and how this feature is verified without waiting for the cron). */
  @Post('auto-payouts/run')
  @Roles(UserRole.ADMIN)
  runAutoPayouts() {
    return this.paymentsService.runAutoPayouts();
  }
}
