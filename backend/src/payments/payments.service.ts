import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentMethod, PaymentStatus } from '../entities/payment.entity';
import { VehicleType } from '../entities/vehicle.entity';
import { WalletService } from '../wallet/wallet.service';
import { DriversService } from '../drivers/drivers.service';
import { UsersService } from '../users/users.service';
import {
  DEFAULT_DEV_AUTO_COMPLETE_DELAY_MS,
  MOBILE_MONEY_DEV_AUTO_COMPLETE_DELAY_MS_ENV,
  MOBILE_MONEY_DEV_AUTO_COMPLETE_ENV,
} from '../config/mobile-money.config';
import { MobileMoneyService } from './mobile-money.service';
import { RequestPayoutDto } from './dto/request-payout.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment) private readonly payments: Repository<Payment>,
    private readonly walletService: WalletService,
    private readonly driversService: DriversService,
    private readonly usersService: UsersService,
    private readonly mobileMoneyService: MobileMoneyService,
    private readonly config: ConfigService,
  ) {}

  /** Cash is settled the moment the driver marks the trip complete — see TripsService.complete(). */
  async recordCashPayment(
    tripId: string,
    driverId: string,
    riderId: string,
    fareAmount: number,
    vehicleType?: VehicleType,
  ): Promise<Payment> {
    const payment = await this.payments.save(
      this.payments.create({
        tripId,
        driverId,
        riderId,
        method: PaymentMethod.CASH,
        status: PaymentStatus.COLLECTED,
        amount: fareAmount.toFixed(2),
      }),
    );
    await this.walletService.applyTripCommission(driverId, tripId, fareAmount, vehicleType);
    return payment;
  }

  /** Kicks off a MoMo/Airtel Money request-to-pay against the rider's phone. Trip completion doesn't wait for it — the payment resolves asynchronously. */
  async initiateMobileMoneyPayment(
    tripId: string,
    driverId: string,
    riderId: string,
    riderPhoneNumber: string,
    fareAmount: number,
    method: PaymentMethod,
  ): Promise<Payment> {
    let payment = await this.payments.save(
      this.payments.create({
        tripId,
        driverId,
        riderId,
        method,
        status: PaymentStatus.PENDING,
        amount: fareAmount.toFixed(2),
      }),
    );

    const { providerReference } = await this.mobileMoneyService.requestToPay(
      riderPhoneNumber,
      fareAmount,
      payment.id,
      method,
    );
    payment.providerReference = providerReference;
    payment = await this.payments.save(payment);

    if (this.config.get(MOBILE_MONEY_DEV_AUTO_COMPLETE_ENV, 'true') === 'true') {
      const delayMs = Number(
        this.config.get(MOBILE_MONEY_DEV_AUTO_COMPLETE_DELAY_MS_ENV, DEFAULT_DEV_AUTO_COMPLETE_DELAY_MS),
      );
      setTimeout(() => {
        this.handleCallback(payment.id, true).catch((err) =>
          this.logger.error(`Dev auto-complete failed for payment ${payment.id}`, err),
        );
      }, delayMs);
    }

    return payment;
  }

  /**
   * Resolves a pending mobile money payment — called by the provider
   * webhook in production, or by the dev auto-complete timer above.
   * Idempotent: a duplicate/late callback on an already-resolved payment
   * is a no-op, since providers do sometimes retry webhooks.
   */
  async handleCallback(paymentId: string, success: boolean, providerReference?: string): Promise<Payment> {
    const payment = await this.payments.findOneBy({ id: paymentId });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.status !== PaymentStatus.PENDING) {
      return payment;
    }
    if (providerReference) {
      payment.providerReference = providerReference;
    }

    if (!success) {
      payment.status = PaymentStatus.FAILED;
      return this.payments.save(payment);
    }

    payment.status = PaymentStatus.COLLECTED;
    const saved = await this.payments.save(payment);

    if (payment.driverId) {
      const driver = await this.driversService.findById(payment.driverId);
      await this.walletService.creditTripEarning(
        payment.driverId,
        payment.tripId,
        Number(payment.amount),
        driver.vehicle?.type,
      );
    }

    return saved;
  }

  async findById(paymentId: string): Promise<Payment> {
    const payment = await this.payments.findOneBy({ id: paymentId });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  async findByTripId(tripId: string): Promise<Payment | null> {
    return this.payments.findOneBy({ tripId });
  }

  /** Driver cashes out a positive wallet balance (built up from mobile money trip earnings) to their phone. */
  async requestPayout(
    driverUserId: string,
    dto: RequestPayoutDto,
  ): Promise<{ amount: number; providerReference: string; balance: number }> {
    const driver = await this.driversService.getByUserId(driverUserId);
    const balance = await this.walletService.getBalance(driver.id);
    if (dto.amount > balance) {
      throw new BadRequestException(
        `Payout of K${dto.amount.toFixed(2)} exceeds available balance of K${balance.toFixed(2)}`,
      );
    }

    const user = await this.usersService.findById(driverUserId);
    const phoneNumber = dto.phoneNumber ?? user.phoneNumber;
    const { providerReference } = await this.mobileMoneyService.disburse(
      phoneNumber,
      dto.amount,
      `payout-${driver.id}-${Date.now()}`,
      dto.method,
    );
    const wallet = await this.walletService.recordPayout(driver.id, dto.amount, providerReference);

    return { amount: dto.amount, providerReference, balance: Number(wallet.balance) };
  }
}
