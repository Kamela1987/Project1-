import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import {
  AUTO_PAYOUT_CRON_ENV,
  AUTO_PAYOUT_ENABLED_ENV,
  DEFAULT_AUTO_PAYOUT_CRON,
} from '../config/auto-payout.config';
import { PaymentsService } from './payments.service';

/**
 * Registers PaymentsService.runAutoPayouts on a cron schedule, rather than
 * a static `@Cron()` decorator, so the schedule is configurable via
 * AUTO_PAYOUT_CRON at boot without a code change — and so
 * AUTO_PAYOUT_ENABLED=false (the default; this is off unless explicitly
 * turned on) skips registering the job at all, not just skipping the
 * run, which is easier to confirm ("is this job even registered?") in an
 * ops/ci context than a no-op run would be.
 */
@Injectable()
export class PayoutSchedulerService {
  private readonly logger = new Logger(PayoutSchedulerService.name);
  private static readonly JOB_NAME = 'auto-payouts';

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly config: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    if (this.config.get(AUTO_PAYOUT_ENABLED_ENV, 'false') !== 'true') {
      return;
    }
    const cronExpression = this.config.get<string>(AUTO_PAYOUT_CRON_ENV, DEFAULT_AUTO_PAYOUT_CRON);
    const job = new CronJob(cronExpression, () => this.runAutoPayouts());
    this.schedulerRegistry.addCronJob(PayoutSchedulerService.JOB_NAME, job);
    job.start();
    this.logger.log(`Automatic driver payouts scheduled: "${cronExpression}"`);
  }

  private async runAutoPayouts(): Promise<void> {
    this.logger.log('Running automatic driver payouts...');
    const summary = await this.paymentsService.runAutoPayouts();
    this.logger.log(
      `Automatic driver payouts complete: ${summary.processed} paid (K${summary.totalAmount.toFixed(2)} total), ${summary.failed} failed`,
    );
  }
}
