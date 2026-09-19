import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from '../entities/payment.entity';
import { WalletModule } from '../wallet/wallet.module';
import { DriversModule } from '../drivers/drivers.module';
import { UsersModule } from '../users/users.module';
import { MobileMoneyService } from './mobile-money.service';
import { PaymentsService } from './payments.service';
import { PayoutSchedulerService } from './payout-scheduler.service';
import { PaymentsController } from './payments.controller';
import { PaymentsWebhookController } from './payments-webhook.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Payment]), WalletModule, DriversModule, UsersModule],
  controllers: [PaymentsController, PaymentsWebhookController],
  providers: [PaymentsService, MobileMoneyService, PayoutSchedulerService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
