import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Dispute } from '../entities/dispute.entity';
import { AuditModule } from '../audit/audit.module';
import { DisputesService } from './disputes.service';
import { DisputesController } from './disputes.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Dispute]), AuditModule],
  controllers: [DisputesController],
  providers: [DisputesService],
  exports: [DisputesService],
})
export class DisputesModule {}
