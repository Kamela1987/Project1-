import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/current-user.decorator';
import { UserRole } from '../entities/user.entity';
import { WalletService } from '../wallet/wallet.service';
import { RegisterDriverDto } from './dto/register-driver.dto';
import { RegisterVehicleDto } from './dto/register-vehicle.dto';
import { SetOnlineDto } from './dto/set-online.dto';
import { SettleWalletDto } from './dto/settle-wallet.dto';
import { DriversService } from './drivers.service';

@Controller('drivers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DriversController {
  constructor(
    private readonly driversService: DriversService,
    private readonly walletService: WalletService,
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
