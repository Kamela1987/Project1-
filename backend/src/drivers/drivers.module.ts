import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Driver } from '../entities/driver.entity';
import { Vehicle } from '../entities/vehicle.entity';
import { WalletModule } from '../wallet/wallet.module';
import { RatingsModule } from '../ratings/ratings.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { DriversController } from './drivers.controller';
import { DriversService } from './drivers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Driver, Vehicle]),
    WalletModule,
    RatingsModule,
    RealtimeModule,
  ],
  controllers: [DriversController],
  providers: [DriversService],
  exports: [DriversService],
})
export class DriversModule {}
