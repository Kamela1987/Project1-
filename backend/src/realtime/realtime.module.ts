import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Driver } from '../entities/driver.entity';
import { Trip } from '../entities/trip.entity';
import { AuthModule } from '../auth/auth.module';
import { redisProvider } from './redis.provider';
import { LocationService } from './location.service';
import { LocationGateway } from './location.gateway';
import { DispatchService } from './dispatch.service';

@Module({
  imports: [TypeOrmModule.forFeature([Driver, Trip]), AuthModule],
  providers: [redisProvider, LocationService, LocationGateway, DispatchService],
  exports: [LocationService, DispatchService],
})
export class RealtimeModule {}
