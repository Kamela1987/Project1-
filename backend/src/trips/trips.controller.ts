import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuthenticatedUser, CurrentUser } from '../common/current-user.decorator';
import { UserRole } from '../entities/user.entity';
import { Trip, TripStatus } from '../entities/trip.entity';
import { PaymentsService } from '../payments/payments.service';
import { LocationService } from '../realtime/location.service';
import { RatingsService } from '../ratings/ratings.service';
import { CreateRatingDto } from '../ratings/dto/create-rating.dto';
import { DisputesService } from '../disputes/disputes.service';
import { CreateDisputeDto } from '../disputes/dto/create-dispute.dto';
import { DriversService } from '../drivers/drivers.service';
import { CompleteTripDto } from './dto/complete-trip.dto';
import { RequestTripDto } from './dto/request-trip.dto';
import { FareEstimateDto } from './dto/fare-estimate.dto';
import { TripsService } from './trips.service';

@Controller('trips')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TripsController {
  constructor(
    private readonly tripsService: TripsService,
    private readonly paymentsService: PaymentsService,
    private readonly locationService: LocationService,
    private readonly ratingsService: RatingsService,
    private readonly disputesService: DisputesService,
    private readonly driversService: DriversService,
  ) {}

  @Post()
  @Roles(UserRole.RIDER)
  request(@CurrentUser() user: AuthenticatedUser, @Body() dto: RequestTripDto) {
    return this.tripsService.request(user.userId, dto);
  }

  /** Rider-facing "what will this roughly cost" screen, ahead of requesting a trip — see TripsService.estimateFare. */
  @Post('fare-estimate')
  fareEstimate(@Body() dto: FareEstimateDto) {
    return this.tripsService.estimateFare(dto);
  }

  /** Sorted by distance to the calling driver's last-known position, when known — see TripsService.listAvailable. */
  @Get('available')
  @Roles(UserRole.DRIVER)
  async listAvailable(@CurrentUser() user: AuthenticatedUser) {
    const driver = await this.driversService.getByUserId(user.userId);
    const location = await this.locationService.getLocation(driver.id);
    return this.tripsService.listAvailable(location?.lat, location?.lng);
  }

  @Get('mine')
  @Roles(UserRole.RIDER)
  listMine(@CurrentUser() user: AuthenticatedUser) {
    return this.tripsService.listMine(user.userId);
  }

  /** Admin's live-monitoring feed. `?status=in_progress` etc. to filter. */
  @Get()
  @Roles(UserRole.ADMIN)
  listAll(@Query('status') status?: TripStatus) {
    return this.tripsService.listAll(status);
  }

  @Get(':id')
  async findById(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const trip = await this.tripsService.findById(id);
    await this.assertTripParticipantOrAdmin(trip, user);
    return trip;
  }

  /** For mobile-money trips: lets the rider/driver poll whether the payment collected. `null` for a trip that isn't there yet (still in progress). */
  @Get(':id/payment')
  async payment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const trip = await this.tripsService.findById(id);
    await this.assertTripParticipantOrAdmin(trip, user);
    return this.paymentsService.findByTripId(id);
  }

  /**
   * REST fallback for the live-tracking WebSocket (see realtime/location.gateway.ts)
   * — offline/low-connectivity clients poll this instead. `null` if the
   * trip has no driver yet, or the driver hasn't reported a position
   * recently (see LocationService's TTL).
   */
  @Get(':id/location')
  async location(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const trip = await this.tripsService.findById(id);
    await this.assertTripParticipantOrAdmin(trip, user);
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
  async rating(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const trip = await this.tripsService.findById(id);
    await this.assertTripParticipantOrAdmin(trip, user);
    return this.ratingsService.findByTripId(id);
  }

  /** Either party on a trip can raise a dispute (fare disagreement, no-show, safety concern); an admin resolves it via DisputesController. */
  @Post(':id/disputes')
  @Roles(UserRole.RIDER, UserRole.DRIVER)
  async raiseDispute(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateDisputeDto,
  ) {
    const trip = await this.tripsService.findById(id);
    await this.assertTripParticipantOrAdmin(trip, user);
    return this.disputesService.create(id, user.userId, dto);
  }

  @Get(':id/disputes')
  async disputes(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    const trip = await this.tripsService.findById(id);
    await this.assertTripParticipantOrAdmin(trip, user);
    return this.disputesService.findByTrip(id);
  }

  /** Riders/drivers may only touch their own trip; admins may touch any. */
  private async assertTripParticipantOrAdmin(trip: Trip, user: AuthenticatedUser): Promise<void> {
    if (user.role === UserRole.ADMIN) return;
    if (trip.riderId === user.userId) return;
    if (user.role === UserRole.DRIVER && trip.driverId) {
      const driver = await this.driversService.getByUserId(user.userId);
      if (driver.id === trip.driverId) return;
    }
    throw new ForbiddenException('Not a participant on this trip');
  }
}
