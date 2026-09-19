import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/current-user.decorator';
import { UserRole } from '../entities/user.entity';
import { WalletService } from '../wallet/wallet.service';
import { RatingsService } from '../ratings/ratings.service';
import { DriverVerificationStatus } from '../entities/driver.entity';
import { RegisterDriverDto } from './dto/register-driver.dto';
import { RegisterVehicleDto } from './dto/register-vehicle.dto';
import { SetOnlineDto } from './dto/set-online.dto';
import { SettleWalletDto } from './dto/settle-wallet.dto';
import { UpdatePayoutSettingsDto } from './dto/update-payout-settings.dto';
import { DriversService } from './drivers.service';

@Controller('drivers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DriversController {
  constructor(
    private readonly driversService: DriversService,
    private readonly walletService: WalletService,
    private readonly ratingsService: RatingsService,
  ) {}

  @Post('register')
  @Roles(UserRole.DRIVER)
  register(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterDriverDto) {
    return this.driversService.register(user.userId, dto);
  }

  @Get('me')
  @Roles(UserRole.DRIVER)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.driversService.getByUserId(user.userId);
  }

  @Post('vehicle')
  @Roles(UserRole.DRIVER)
  registerVehicle(@CurrentUser() user: AuthenticatedUser, @Body() dto: RegisterVehicleDto) {
    return this.driversService.registerVehicle(user.userId, dto);
  }

  @Patch('online')
  @Roles(UserRole.DRIVER)
  setOnline(@CurrentUser() user: AuthenticatedUser, @Body() dto: SetOnlineDto) {
    return this.driversService.setOnline(user.userId, dto.isOnline);
  }

  /** Opt in/out of automatic wallet payouts (PaymentsService.runAutoPayouts) and set which mobile money provider to pay out to. */
  @Patch('me/payout-settings')
  @Roles(UserRole.DRIVER)
  updatePayoutSettings(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdatePayoutSettingsDto) {
    return this.driversService.updatePayoutSettings(user.userId, dto);
  }

  /** Driver's own commission balance + recent ledger entries. */
  @Get('me/wallet')
  @Roles(UserRole.DRIVER)
  async myWallet(@CurrentUser() user: AuthenticatedUser) {
    const driver = await this.driversService.getByUserId(user.userId);
    const [balance, entries] = await Promise.all([
      this.walletService.getBalance(driver.id),
      this.walletService.listEntries(driver.id),
    ]);
    return { balance, entries };
  }

  /** Driver's own aggregate rating from completed trips. */
  @Get('me/rating')
  @Roles(UserRole.DRIVER)
  async myRating(@CurrentUser() user: AuthenticatedUser) {
    const driver = await this.driversService.getByUserId(user.userId);
    return this.ratingsService.getDriverAggregate(driver.id);
  }

  /** Onboarding queue by default (`?status=pending`) or every driver. */
  @Get()
  @Roles(UserRole.ADMIN)
  listAll(@Query('status') status?: DriverVerificationStatus) {
    return this.driversService.listAll(status);
  }

  /** Single driver's full profile (vehicle, wallet balance, rating) for the admin dashboard's detail view. */
  @Get(':driverId')
  @Roles(UserRole.ADMIN)
  async findById(@Param('driverId') driverId: string) {
    const driver = await this.driversService.findById(driverId);
    const [balance, rating] = await Promise.all([
      this.walletService.getBalance(driverId),
      this.ratingsService.getDriverAggregate(driverId),
    ]);
    return { ...driver, walletBalance: balance, rating };
  }

  @Patch(':driverId/approve')
  @Roles(UserRole.ADMIN)
  approve(@Param('driverId') driverId: string) {
    return this.driversService.approve(driverId);
  }

  /** Admin records a driver paying down commission they owe the platform (cash to the office, or a manually-logged MoMo remittance in Phase 1). */
  @Post(':driverId/wallet/settlements')
  @Roles(UserRole.ADMIN)
  settleWallet(@Param('driverId') driverId: string, @Body() dto: SettleWalletDto) {
    return this.walletService.recordSettlement(driverId, dto.amount, dto.note);
  }
}
