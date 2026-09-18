import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Wallet } from './wallet.entity';

export enum LedgerEntryType {
  /** Platform's cut of a completed cash trip; always negative (owed by driver). */
  COMMISSION = 'commission',
  /** A driver paying down what they owe the platform; always positive. */
  SETTLEMENT = 'settlement',
  /**
   * What the platform owes the driver for a trip paid by mobile money
   * (platform holds the fare, owes the driver their net share). Not
   * produced by any flow yet — Phase 1 is cash-only — but modeled now so
   * Phase 2's mobile-money payout doesn't need a schema change.
   */
  TRIP_EARNING = 'trip_earning',
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

  @Column({ name: 'trip_id', nullable: true })
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
