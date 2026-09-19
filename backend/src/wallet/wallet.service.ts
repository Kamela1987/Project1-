import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Wallet } from '../entities/wallet.entity';
import { LedgerEntry, LedgerEntryType } from '../entities/ledger-entry.entity';
import { VehicleType } from '../entities/vehicle.entity';
import { COMMISSION_RATES, DEFAULT_COMMISSION_RATE } from '../config/commission.config';

@Injectable()
export class WalletService {
  constructor(
    @InjectRepository(Wallet) private readonly wallets: Repository<Wallet>,
    @InjectRepository(LedgerEntry) private readonly entries: Repository<LedgerEntry>,
  ) {}

  async getOrCreateWallet(driverId: string): Promise<Wallet> {
    let wallet = await this.wallets.findOneBy({ driverId });
    if (!wallet) {
      wallet = await this.wallets.save(this.wallets.create({ driverId, balance: '0.00' }));
    }
    return wallet;
  }

  async getBalance(driverId: string): Promise<number> {
    const wallet = await this.getOrCreateWallet(driverId);
    return Number(wallet.balance);
  }

  async listEntries(driverId: string, limit = 50): Promise<LedgerEntry[]> {
    const wallet = await this.getOrCreateWallet(driverId);
    return this.entries.find({
      where: { walletId: wallet.id },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  /**
   * Deducts the platform's commission for a completed cash trip. The
   * driver already holds the full fare in cash, so this is recorded as a
   * debt (negative ledger entry / balance) rather than an actual transfer
   * — settlement happens separately (see `recordSettlement`).
   */
  async applyTripCommission(
    driverId: string,
    tripId: string,
    fareAmount: number,
    vehicleType?: VehicleType,
  ): Promise<{ commissionAmount: number; rate: number; balance: number }> {
    const rate = (vehicleType && COMMISSION_RATES[vehicleType]) ?? DEFAULT_COMMISSION_RATE;
    const commissionAmount = Math.round(fareAmount * rate * 100) / 100;

    const wallet = await this.getOrCreateWallet(driverId);
    await this.entries.save(
      this.entries.create({
        walletId: wallet.id,
        tripId,
        type: LedgerEntryType.COMMISSION,
        amount: (-commissionAmount).toFixed(2),
        note: `${Math.round(rate * 100)}% platform commission on cash fare`,
      }),
    );
    wallet.balance = (Number(wallet.balance) - commissionAmount).toFixed(2);
    await this.wallets.save(wallet);

    return { commissionAmount, rate, balance: Number(wallet.balance) };
  }

  /** Records a driver paying down what they owe the platform (e.g. cash handed to an admin, or a MoMo remittance logged manually in Phase 1). */
  async recordSettlement(driverId: string, amount: number, note?: string): Promise<Wallet> {
    const wallet = await this.getOrCreateWallet(driverId);
    await this.entries.save(
      this.entries.create({
        walletId: wallet.id,
        type: LedgerEntryType.SETTLEMENT,
        amount: amount.toFixed(2),
        note,
      }),
    );
    wallet.balance = (Number(wallet.balance) + amount).toFixed(2);
    return this.wallets.save(wallet);
  }

  /**
   * Credits a driver's wallet with their net share of a mobile-money trip
   * once the platform has actually collected the fare — the mirror image
   * of `applyTripCommission`, since here the platform holds the money and
   * owes the driver, rather than the other way around.
   */
  async creditTripEarning(
    driverId: string,
    tripId: string,
    fareAmount: number,
    vehicleType?: VehicleType,
  ): Promise<{ netAmount: number; commissionAmount: number; rate: number; balance: number }> {
    const rate = (vehicleType && COMMISSION_RATES[vehicleType]) ?? DEFAULT_COMMISSION_RATE;
    const commissionAmount = Math.round(fareAmount * rate * 100) / 100;
    const netAmount = Math.round((fareAmount - commissionAmount) * 100) / 100;

    const wallet = await this.getOrCreateWallet(driverId);
    await this.entries.save(
      this.entries.create({
        walletId: wallet.id,
        tripId,
        type: LedgerEntryType.TRIP_EARNING,
        amount: netAmount.toFixed(2),
        note: `Net earning after ${Math.round(rate * 100)}% platform commission (mobile money trip)`,
      }),
    );
    wallet.balance = (Number(wallet.balance) + netAmount).toFixed(2);
    await this.wallets.save(wallet);

    return { netAmount, commissionAmount, rate, balance: Number(wallet.balance) };
  }

  /** Records a driver cashing out a positive wallet balance to their mobile money account. */
  async recordPayout(driverId: string, amount: number, providerReference?: string): Promise<Wallet> {
    const wallet = await this.getOrCreateWallet(driverId);
    await this.entries.save(
      this.entries.create({
        walletId: wallet.id,
        type: LedgerEntryType.PAYOUT,
        amount: (-amount).toFixed(2),
        note: providerReference
          ? `Paid out via mobile money (ref ${providerReference})`
          : 'Paid out via mobile money',
      }),
    );
    wallet.balance = (Number(wallet.balance) - amount).toFixed(2);
    return this.wallets.save(wallet);
  }
}
