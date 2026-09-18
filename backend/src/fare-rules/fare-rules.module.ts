import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FareRule } from '../entities/fare-rule.entity';
import { ZonesModule } from '../zones/zones.module';
import { FareRulesService } from './fare-rules.service';
import { FareRulesController, FareRuleController } from './fare-rules.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FareRule]), ZonesModule],
  controllers: [FareRulesController, FareRuleController],
  providers: [FareRulesService],
})
export class FareRulesModule {}
