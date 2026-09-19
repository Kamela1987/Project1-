import { BadRequestException } from '@nestjs/common';
import { ReferralsService } from './referrals.service';

function makeUser(overrides: Partial<any> = {}) {
  return {
    id: 'user-1',
    referralCode: 'ABCD1234',
    referredByUserId: null,
    referralCreditBalance: '0.00',
    ...overrides,
  };
}

describe('ReferralsService', () => {
  let usersRepo: any;
  let rewardsRepo: any;
  let config: any;
  let service: ReferralsService;

  beforeEach(() => {
    usersRepo = {
      findOneBy: jest.fn(),
      increment: jest.fn(),
      count: jest.fn(),
    };
    rewardsRepo = {
      create: jest.fn((data: any) => data),
      save: jest.fn(async (data: any) => ({ id: 'reward-1', ...data })),
      find: jest.fn(),
    };
    config = { get: jest.fn((_key: string, fallback: unknown) => fallback) };
    service = new ReferralsService(usersRepo, rewardsRepo, config);
  });

  describe('generateUniqueCode', () => {
    it('returns an 8-char uppercase hex code', async () => {
      usersRepo.findOneBy.mockResolvedValue(null);
      const code = await service.generateUniqueCode();
      expect(code).toMatch(/^[0-9A-F]{8}$/);
    });

    it('retries on collision and eventually returns a free code', async () => {
      usersRepo.findOneBy
        .mockResolvedValueOnce(makeUser()) // collision
        .mockResolvedValueOnce(null); // free
      const code = await service.generateUniqueCode();
      expect(code).toMatch(/^[0-9A-F]{8}$/);
      expect(usersRepo.findOneBy).toHaveBeenCalledTimes(2);
    });

    it('gives up after 5 attempts', async () => {
      usersRepo.findOneBy.mockResolvedValue(makeUser());
      await expect(service.generateUniqueCode()).rejects.toThrow('Could not generate a unique referral code');
      expect(usersRepo.findOneBy).toHaveBeenCalledTimes(5);
    });
  });

  describe('resolveReferrer', () => {
    it('returns null when no code is given', async () => {
      expect(await service.resolveReferrer(undefined)).toBeNull();
      expect(usersRepo.findOneBy).not.toHaveBeenCalled();
    });

    it('returns the referrer for a valid code', async () => {
      const referrer = makeUser({ id: 'referrer-1' });
      usersRepo.findOneBy.mockResolvedValue(referrer);
      expect(await service.resolveReferrer('ABCD1234')).toBe(referrer);
    });

    it('rejects an unknown code with 400', async () => {
      usersRepo.findOneBy.mockResolvedValue(null);
      await expect(service.resolveReferrer('NOSUCHCODE')).rejects.toThrow(BadRequestException);
    });
  });

  describe('rewardReferrerForFirstTrip', () => {
    it('is a no-op when the rider was not referred', async () => {
      usersRepo.findOneBy.mockResolvedValue(makeUser({ referredByUserId: null }));
      await service.rewardReferrerForFirstTrip('rider-1', 'trip-1');
      expect(rewardsRepo.save).not.toHaveBeenCalled();
      expect(usersRepo.increment).not.toHaveBeenCalled();
    });

    it('is a no-op when the rider does not exist', async () => {
      usersRepo.findOneBy.mockResolvedValue(null);
      await service.rewardReferrerForFirstTrip('rider-1', 'trip-1');
      expect(rewardsRepo.save).not.toHaveBeenCalled();
    });

    it('credits the referrer the configured amount and records a reward row', async () => {
      usersRepo.findOneBy.mockResolvedValue(makeUser({ id: 'rider-1', referredByUserId: 'referrer-1' }));
      await service.rewardReferrerForFirstTrip('rider-1', 'trip-1');

      expect(rewardsRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          referrerUserId: 'referrer-1',
          referredUserId: 'rider-1',
          tripId: 'trip-1',
          amount: '20.00',
        }),
      );
      expect(usersRepo.increment).toHaveBeenCalledWith({ id: 'referrer-1' }, 'referralCreditBalance', 20);
    });

    it('uses a configured REFERRAL_REWARD_AMOUNT override', async () => {
      config.get = jest.fn((key: string) => (key === 'REFERRAL_REWARD_AMOUNT' ? '35' : undefined));
      usersRepo.findOneBy.mockResolvedValue(makeUser({ id: 'rider-1', referredByUserId: 'referrer-1' }));
      await service.rewardReferrerForFirstTrip('rider-1', 'trip-1');
      expect(usersRepo.increment).toHaveBeenCalledWith({ id: 'referrer-1' }, 'referralCreditBalance', 35);
    });
  });

  describe('getMyReferrals', () => {
    it('returns the code, balance, referred count, and reward history', async () => {
      usersRepo.findOneBy.mockResolvedValue(makeUser({ referralCreditBalance: '40.00' }));
      rewardsRepo.find.mockResolvedValue([{ id: 'reward-1' }]);
      usersRepo.count.mockResolvedValue(2);

      const result = await service.getMyReferrals('user-1');
      expect(result).toEqual({
        referralCode: 'ABCD1234',
        referralCreditBalance: 40,
        referredCount: 2,
        rewards: [{ id: 'reward-1' }],
      });
    });

    it('handles a user with no referralCode gracefully (e.g. an out-of-band admin)', async () => {
      usersRepo.findOneBy.mockResolvedValue(null);
      rewardsRepo.find.mockResolvedValue([]);
      usersRepo.count.mockResolvedValue(0);

      const result = await service.getMyReferrals('admin-1');
      expect(result.referralCode).toBeNull();
      expect(result.referralCreditBalance).toBe(0);
    });
  });
});
