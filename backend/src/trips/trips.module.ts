import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Trip } from '../entities/trip.entity';
import { TripStatusEvent } from '../entities/trip-status-event.entity';
import { DriversModule } from '../drivers/drivers.module';
import { UsersModule } from '../users/users.module';
import { PaymentsModule } from '../payments/payments.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Trip, TripStatusEvent]),
    DriversModule,
    UsersModule,
    PaymentsModule,
    RealtimeModule,
  ],
  controllers: [TripsController],
  providers: [TripsService],
})
export class TripsModule {}
