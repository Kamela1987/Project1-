import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Trip } from '../entities/trip.entity';
import { TripStatusEvent } from '../entities/trip-status-event.entity';
import { Payment } from '../entities/payment.entity';
import { DriversModule } from '../drivers/drivers.module';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  imports: [TypeOrmModule.forFeature([Trip, TripStatusEvent, Payment]), DriversModule],
  controllers: [TripsController],
  providers: [TripsService],
})
export class TripsModule {}
