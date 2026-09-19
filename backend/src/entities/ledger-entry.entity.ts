import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Wallet } from './wallet.entity';

export enum LedgerEntryType {
  /** Platform's cut of a completed cash trip; always negative (owed by driver). */
  COMMISSION = 'commission',
  /** A driver paying down what they owe the platform; always positive. */
  SETTLEMENT = 'settlement',
  /**
   * What the platform owes the driver for a trip paid by mobile money —
   * the platform holds the fare and credits the driver's wallet with
   * their net share (fare minus commission), payable out on request.
   */
  TRIP_EARNING = 'trip_earning',
  /** A driver cashing out a positive wallet balance to their mobile money account. */
  PAYOUT = 'payout',
}

/** Append-only audit trail behind Wallet.balance. */
@Entity('ledger_entries')
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Wallet)
  @JoinColumn({ name: 'wallet_id' })
  wallet: Wallet;

  @Column({ name: 'wallet_id' })
  walletId: string;

  @Column('uuid', { name: 'trip_id', nullable: true })
  tripId?: string;

  @Column({ type: 'enum', enum: LedgerEntryType })
  type: LedgerEntryType;

  @Column('decimal', { precision: 10, scale: 2 })
  amount: string;

  @Column({ nullable: true })
  note?: string;

  @CreateDateColumn()
  createdAt: Date;
}
