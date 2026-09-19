import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * One wallet per driver, tracking what's owed between the driver and the
 * platform. Balance is negative when the driver owes the platform
 * commission on cash fares they've already collected; a settlement moves
 * it back toward zero. See docs/MONZE_RIDE_ARCHITECTURE.md §5 (WALLET,
 * LEDGER_ENTRY) and §10 (commission open question).
 */
@Entity('wallets')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'driver_id', unique: true })
  driverId: string;

  @Column('decimal', { precision: 10, scale: 2, default: 0 })
  balance: string;
}
