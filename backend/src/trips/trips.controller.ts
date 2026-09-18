import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/current-user.decorator';
import { UserRole } from '../entities/user.entity';
import { CompleteTripDto } from './dto/complete-trip.dto';
import { RequestTripDto } from './dto/request-trip.dto';
import { TripsService } from './trips.service';

@Controller('trips')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post()
  @Roles(UserRole.RIDER)
  request(@CurrentUser() user: AuthenticatedUser, @Body() dto: RequestTripDto) {
    return this.tripsService.request(user.userId, dto);
  }

  @Get('available')
  @Roles(UserRole.DRIVER)
  listAvailable() {
    return this.tripsService.listAvailable();
  }

  @Get('mine')
  @Roles(UserRole.RIDER)
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.tripsService.listMine(user.userId);
  }

  @Get(':id')
  findById(@Param('id') id: string) {
    return this.tripsService.findById(id);
  }

  @Patch(':id/accept')
  @Roles(UserRole.DRIVER)
  accept(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tripsService.accept(id, user.userId);
  }

  @Patch(':id/arrived')
  @Roles(UserRole.DRIVER)
  markArrived(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tripsService.markArrived(id, user.userId);
  }

  @Patch(':id/start')
  @Roles(UserRole.DRIVER)
  start(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tripsService.start(id, user.userId);
  }

  @Patch(':id/complete')
  @Roles(UserRole.DRIVER)
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CompleteTripDto,
  ) {
    return this.tripsService.complete(id, user.userId, dto);
  }

  @Patch(':id/cancel')
  @Roles(UserRole.RIDER)
  cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.tripsService.cancel(id, user.userId);
  }
}
