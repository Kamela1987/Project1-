import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Town } from '../entities/town.entity';
import { TownsService } from './towns.service';
import { TownsController } from './towns.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Town])],
  controllers: [TownsController],
  providers: [TownsService],
  exports: [TownsService],
})
export class TownsModule {}
