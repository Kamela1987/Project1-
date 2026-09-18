import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/current-user.decorator';
import { UserRole } from '../entities/user.entity';
import { TripStatus } from '../entities/trip.entity';
import { PaymentsService } from '../payments/payments.service';
import { LocationService } from '../realtime/location.service';
import { RatingsService } from '../ratings/ratings.service';
import { CreateRatingDto } from '../ratings/dto/create-rating.dto';
import { CompleteTripDto } from './dto/complete-trip.dto';
import { RequestTripDto } from './dto/request-trip.dto';
import { TripsService } from './trips.service';

@Controller('trips')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TripsController {
  constructor(
    private readonly tripsService: TripsService,
    private readonly paymentsService: PaymentsService,
    private readonly locationService: LocationService,
    private readonly ratingsService: RatingsService,
  ) {}

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

  /** For mobile-money trips: lets the rider/driver poll whether the payment collected. `null` for a trip that isn't there yet (still in progress). */
  @Get(':id/payment')
  payment(@Param('id') id: string) {
    return this.paymentsService.findByTripId(id);
  }

  /**
   * REST fallback for the live-tracking WebSocket (see realtime/location.gateway.ts)
   * — offline/low-connectivity clients poll this instead. `null` if the
   * trip has no driver yet, or the driver hasn't reported a position
   * recently (see LocationService's TTL).
   */
  @Get(':id/location')
  async location(@Param('id') id: string) {
    const trip = await this.tripsService.findById(id);
    if (!trip.driverId) {
      return null;
    }
    return this.locationService.getLocation(trip.driverId);
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

  /**
   * One rating per completed trip, submitted by the rider only. Validation
   * needs `Trip` state (ownership, completion, driver assignment), which
   * RatingsService deliberately doesn't own — same shape as the `location()`
   * passthrough's inline `trip.driverId` check above.
   */
  @Post(':id/rating')
  @Roles(UserRole.RIDER)
  async rate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateRatingDto,
  ) {
    const trip = await this.tripsService.findById(id);
    if (trip.riderId !== user.userId) {
      throw new ForbiddenException('Not your trip');
    }
    if (trip.status !== TripStatus.COMPLETED) {
      throw new BadRequestException('Trip is not completed yet');
    }
    if (!trip.driverId) {
      throw new BadRequestException('Trip has no assigned driver');
    }
    return this.ratingsService.submit(id, user.userId, trip.driverId, dto);
  }

  /** `null` if the trip hasn't been rated yet. */
  @Get(':id/rating')
  rating(@Param('id') id: string) {
    return this.ratingsService.findByTripId(id);
  }
}
