import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/current-user.decorator';
import { UserRole } from '../entities/user.entity';
import { RegisterDriverDto } from './dto/register-driver.dto';
import { RegisterVehicleDto } from './dto/register-vehicle.dto';
import { SetOnlineDto } from './dto/set-online.dto';
import { DriversService } from './drivers.service';

@Controller('drivers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

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

  @Patch(':driverId/approve')
  @Roles(UserRole.ADMIN)
  approve(@Param('driverId') driverId: string) {
    return this.driversService.approve(driverId);
  }
}
