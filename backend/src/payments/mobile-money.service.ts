import { randomUUID } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { PaymentMethod } from '../entities/payment-method.enum';

export interface MobileMoneyResult {
  providerReference: string;
}

/**
 * Stand-in for MTN Mobile Money's Collections/Disbursements APIs and
 * Airtel Money's equivalent — this repo has no real sandbox credentials,
 * so every call just logs what a production integration would send and
 * returns a fake reference. Swap the bodies of these two methods for real
 * HTTP calls (and real webhook signature verification on the way back)
 * before this touches real money. See docs/MONZE_RIDE_ARCHITECTURE.md §3.
 */
@Injectable()
export class MobileMoneyService {
  private readonly logger = new Logger(MobileMoneyService.name);

  async requestToPay(
    phoneNumber: string,
    amount: number,
    externalId: string,
    method: PaymentMethod,
  ): Promise<MobileMoneyResult> {
    const providerReference = randomUUID();
    this.logger.log(
      `[DEV] ${this.providerName(method)} request-to-pay: ${phoneNumber} for K${amount.toFixed(2)} ` +
        `(externalId=${externalId}, providerReference=${providerReference})`,
    );
    return { providerReference };
  }

  async disburse(
    phoneNumber: string,
    amount: number,
    externalId: string,
    method: PaymentMethod,
  ): Promise<MobileMoneyResult> {
    const providerReference = randomUUID();
    this.logger.log(
      `[DEV] ${this.providerName(method)} disbursement: ${phoneNumber} for K${amount.toFixed(2)} ` +
        `(externalId=${externalId}, providerReference=${providerReference})`,
    );
    return { providerReference };
  }

  private providerName(method: PaymentMethod): string {
    return method === PaymentMethod.MOMO ? 'MTN MoMo' : 'Airtel Money';
  }
}
