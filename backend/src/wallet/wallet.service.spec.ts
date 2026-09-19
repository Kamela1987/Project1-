import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { WalletService } from './wallet.service';
import { Wallet } from '../entities/wallet.entity';
import { LedgerEntry } from '../entities/ledger-entry.entity';
import { VehicleType } from '../entities/vehicle.entity';

/** Minimal in-memory stand-in for the two repositories WalletService uses — no real DB. */
function createRepoMock<T extends { id?: string }>() {
  const rows: T[] = [];
  let nextId = 1;
  return {
    rows,
    findOneBy: jest.fn(async (where: Partial<T>) => {
      const [key, value] = Object.entries(where)[0];
      return rows.find((r) => (r as any)[key] === value) ?? null;
    }),
    create: jest.fn((data: Partial<T>) => ({ ...data }) as T),
    save: jest.fn(async (entity: T) => {
      if (!entity.id) {
        entity.id = String(nextId++);
        rows.push(entity);
      } else {
        const index = rows.findIndex((r) => r.id === entity.id);
        if (index === -1) rows.push(entity);
        else rows[index] = entity;
      }
      return entity;
    }),
    find: jest.fn(async () => rows),
  };
}

describe('WalletService', () => {
  let service: WalletService;
  let walletsRepo: ReturnType<typeof createRepoMock<Wallet>>;
  let entriesRepo: ReturnType<typeof createRepoMock<LedgerEntry>>;

  beforeEach(async () => {
    walletsRepo = createRepoMock<Wallet>();
    entriesRepo = createRepoMock<LedgerEntry>();

    const module = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: getRepositoryToken(Wallet), useValue: walletsRepo },
        { provide: getRepositoryToken(LedgerEntry), useValue: entriesRepo },
      ],
    }).compile();

    service = module.get(WalletService);
  });

  describe('getOrCreateWallet', () => {
    it('creates a zero-balance wallet on first use', async () => {
      const wallet = await service.getOrCreateWallet('driver-1');
      expect(wallet.balance).toBe('0.00');
      expect(walletsRepo.rows).toHaveLength(1);
    });

    it('reuses an existing wallet instead of creating a second one', async () => {
      const first = await service.getOrCreateWallet('driver-1');
      const second = await service.getOrCreateWallet('driver-1');
      expect(second.id).toBe(first.id);
      expect(walletsRepo.rows).toHaveLength(1);
    });
  });

  describe('applyTripCommission', () => {
    it('deducts the vehicle-specific commission rate as a debt', async () => {
      const result = await service.applyTripCommission('driver-1', 'trip-1', 100, VehicleType.SEDAN);
      expect(result.rate).toBe(0.15);
      expect(result.commissionAmount).toBe(15);
      expect(result.balance).toBe(-15);
    });

    it('falls back to the default rate when no vehicle type is given', async () => {
      const result = await service.applyTripCommission('driver-1', 'trip-1', 100);
      expect(result.rate).toBe(0.15);
    });

    it('uses the lower motorbike rate', async () => {
      const result = await service.applyTripCommission('driver-1', 'trip-1', 100, VehicleType.MOTORBIKE);
      expect(result.rate).toBe(0.1);
      expect(result.commissionAmount).toBe(10);
    });

    it('accumulates across multiple trips', async () => {
      await service.applyTripCommission('driver-1', 'trip-1', 100, VehicleType.SEDAN);
      const second = await service.applyTripCommission('driver-1', 'trip-2', 50, VehicleType.SEDAN);
      expect(second.balance).toBe(-22.5);
    });
  });

  describe('recordSettlement', () => {
    it('moves a negative balance back toward zero', async () => {
      await service.applyTripCommission('driver-1', 'trip-1', 100, VehicleType.SEDAN);
      const wallet = await service.recordSettlement('driver-1', 15);
      expect(Number(wallet.balance)).toBe(0);
    });
  });

  describe('creditTripEarning', () => {
    it('credits the fare minus commission, not the full fare', async () => {
      const result = await service.creditTripEarning('driver-1', 'trip-1', 100, VehicleType.SEDAN);
      expect(result.commissionAmount).toBe(15);
      expect(result.netAmount).toBe(85);
      expect(result.balance).toBe(85);
    });
  });

  describe('recordPayout', () => {
    it('deducts the payout amount from the balance', async () => {
      await service.creditTripEarning('driver-1', 'trip-1', 100, VehicleType.SEDAN);
      const wallet = await service.recordPayout('driver-1', 85, 'provider-ref-1');
      expect(Number(wallet.balance)).toBe(0);
    });
  });

  describe('getBalance', () => {
    it('returns 0 for a driver with no wallet yet', async () => {
      expect(await service.getBalance('never-seen')).toBe(0);
    });
  });
});
