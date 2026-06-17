import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { LimitsService } from './limits.service';
import { LimitsRepository } from './limits.repository';
import { TierLimitsConfig } from './tier-limits.config';
import { PrismaService } from '../prisma/prisma.service';

describe('LimitsService', () => {
  let service: LimitsService;
  let repository: jest.Mocked<LimitsRepository>;
  let tierConfig: { get: jest.Mock };
  let tx: {
    $executeRaw: jest.Mock;
    user: { findUnique: jest.Mock };
    list: { count: jest.Mock };
    item: { count: jest.Mock };
  };
  let prisma: { $transaction: jest.Mock };

  beforeEach(async () => {
    tierConfig = { get: jest.fn() };

    tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      user: { findUnique: jest.fn() },
      list: { count: jest.fn() },
      item: { count: jest.fn() },
    };

    prisma = {
      $transaction: jest
        .fn()
        .mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LimitsService,
        {
          provide: LimitsRepository,
          useValue: {
            getUserTier: jest.fn(),
            countItemsByUser: jest.fn(),
            reserveAiCall: jest.fn(),
            releaseAiReservation: jest.fn(),
            getUserUsage: jest.fn(),
          },
        },
        {
          provide: TierLimitsConfig,
          useValue: tierConfig,
        },
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<LimitsService>(LimitsService);
    repository = module.get(LimitsRepository);
  });

  describe('withListCapLock', () => {
    it('throws LIMIT_REACHED when free user is at list cap', async () => {
      tx.user.findUnique.mockResolvedValue({ tier: 'free' });
      tierConfig.get.mockReturnValue({ maxLists: 3, maxItems: 50, maxAiCallsPerMonth: 10 });
      tx.list.count.mockResolvedValue(3);
      const create = jest.fn();

      await expect(service.withListCapLock('user-1', create)).rejects.toThrow(ForbiddenException);
      expect(create).not.toHaveBeenCalled();
    });

    it('runs create callback when below cap', async () => {
      tx.user.findUnique.mockResolvedValue({ tier: 'free' });
      tierConfig.get.mockReturnValue({ maxLists: 3, maxItems: 50, maxAiCallsPerMonth: 10 });
      tx.list.count.mockResolvedValue(2);
      const create = jest.fn().mockResolvedValue({ id: 'list-1' });

      const result = await service.withListCapLock('user-1', create);

      expect(create).toHaveBeenCalledWith(tx);
      expect(result).toEqual({ id: 'list-1' });
    });

    it('acquires an advisory lock scoped to list-cap:<userId>', async () => {
      tx.user.findUnique.mockResolvedValue({ tier: 'free' });
      tierConfig.get.mockReturnValue({ maxLists: 3, maxItems: 50, maxAiCallsPerMonth: 10 });
      tx.list.count.mockResolvedValue(0);
      const create = jest.fn().mockResolvedValue({});

      await service.withListCapLock('user-1', create);

      expect(tx.$executeRaw).toHaveBeenCalled();
      const params = tx.$executeRaw.mock.calls[0][1];
      expect(params).toBe('list-cap:user-1');
    });

    it('skips count and runs create for premium (infinite cap)', async () => {
      tx.user.findUnique.mockResolvedValue({ tier: 'pro' });
      tierConfig.get.mockReturnValue({
        maxLists: Infinity,
        maxItems: Infinity,
        maxAiCallsPerMonth: Infinity,
      });
      const create = jest.fn().mockResolvedValue({ id: 'list-1' });

      await service.withListCapLock('user-1', create);

      expect(tx.list.count).not.toHaveBeenCalled();
      expect(create).toHaveBeenCalledWith(tx);
    });

    it('defaults to free tier when the user row is missing', async () => {
      tx.user.findUnique.mockResolvedValue(null);
      tierConfig.get.mockReturnValue({ maxLists: 3, maxItems: 50, maxAiCallsPerMonth: 10 });
      tx.list.count.mockResolvedValue(3);
      const create = jest.fn();

      await expect(service.withListCapLock('user-1', create)).rejects.toThrow(ForbiddenException);
      expect(tierConfig.get).toHaveBeenCalledWith('free');
    });
  });

  describe('withItemCapLock', () => {
    it('throws LIMIT_REACHED at item cap', async () => {
      tx.user.findUnique.mockResolvedValue({ tier: 'free' });
      tierConfig.get.mockReturnValue({ maxLists: 3, maxItems: 50, maxAiCallsPerMonth: 10 });
      tx.item.count.mockResolvedValue(50);
      const create = jest.fn();

      await expect(service.withItemCapLock('user-1', create)).rejects.toThrow(ForbiddenException);
      expect(create).not.toHaveBeenCalled();
    });

    it('runs create callback when below cap', async () => {
      tx.user.findUnique.mockResolvedValue({ tier: 'free' });
      tierConfig.get.mockReturnValue({ maxLists: 3, maxItems: 50, maxAiCallsPerMonth: 10 });
      tx.item.count.mockResolvedValue(49);
      const create = jest.fn().mockResolvedValue({ id: 'item-1' });

      const result = await service.withItemCapLock('user-1', create);

      expect(create).toHaveBeenCalledWith(tx);
      expect(result).toEqual({ id: 'item-1' });
    });

    it('acquires an advisory lock scoped to item-cap:<userId>', async () => {
      tx.user.findUnique.mockResolvedValue({ tier: 'free' });
      tierConfig.get.mockReturnValue({ maxLists: 3, maxItems: 50, maxAiCallsPerMonth: 10 });
      tx.item.count.mockResolvedValue(0);
      const create = jest.fn().mockResolvedValue({});

      await service.withItemCapLock('user-1', create);

      const params = tx.$executeRaw.mock.calls[0][1];
      expect(params).toBe('item-cap:user-1');
    });
  });

  describe('reserveAiCall', () => {
    it('throws LIMIT_REACHED when repository cannot reserve a slot', async () => {
      repository.getUserTier.mockResolvedValue('free');
      tierConfig.get.mockReturnValue({ maxLists: 3, maxItems: 50, maxAiCallsPerMonth: 10 });
      repository.reserveAiCall.mockResolvedValue(false);

      await expect(service.reserveAiCall('user-1')).rejects.toThrow(ForbiddenException);
    });

    it('returns true when repository reserves a slot', async () => {
      repository.getUserTier.mockResolvedValue('free');
      tierConfig.get.mockReturnValue({ maxLists: 3, maxItems: 50, maxAiCallsPerMonth: 10 });
      repository.reserveAiCall.mockResolvedValue(true);

      await expect(service.reserveAiCall('user-1')).resolves.toBe(true);
      const call = repository.reserveAiCall.mock.calls[0];
      expect(call[0]).toBe('user-1');
      expect(call[1]).toMatch(/^\d{4}-\d{2}$/);
      expect(call[2]).toBe(10);
    });

    it('returns false for premium (no reservation needed)', async () => {
      repository.getUserTier.mockResolvedValue('pro');
      tierConfig.get.mockReturnValue({
        maxLists: Infinity,
        maxItems: Infinity,
        maxAiCallsPerMonth: Infinity,
      });

      await expect(service.reserveAiCall('user-1')).resolves.toBe(false);
      expect(repository.reserveAiCall).not.toHaveBeenCalled();
    });

    it('throws LIMIT_REACHED immediately when cap is zero', async () => {
      repository.getUserTier.mockResolvedValue('free');
      tierConfig.get.mockReturnValue({ maxLists: 3, maxItems: 50, maxAiCallsPerMonth: 0 });

      await expect(service.reserveAiCall('user-1')).rejects.toThrow(ForbiddenException);
      expect(repository.reserveAiCall).not.toHaveBeenCalled();
    });
  });

  describe('releaseAiReservation', () => {
    it('delegates to repository unconditionally with userId and current month (YYYY-MM)', async () => {
      await service.releaseAiReservation('user-1');

      const call = repository.releaseAiReservation.mock.calls[0];
      expect(call[0]).toBe('user-1');
      expect(call[1]).toMatch(/^\d{4}-\d{2}$/);
      expect(repository.getUserTier).not.toHaveBeenCalled();
    });
  });

  describe('assertCanCreateItem', () => {
    it('throws LIMIT_REACHED when free user is at item cap', async () => {
      repository.getUserTier.mockResolvedValue('free');
      tierConfig.get.mockReturnValue({ maxLists: 3, maxItems: 50, maxAiCallsPerMonth: 10 });
      repository.countItemsByUser.mockResolvedValue(50);

      await expect(service.assertCanCreateItem('user-1')).rejects.toThrow(ForbiddenException);
    });

    it('resolves when below cap', async () => {
      repository.getUserTier.mockResolvedValue('free');
      tierConfig.get.mockReturnValue({ maxLists: 3, maxItems: 50, maxAiCallsPerMonth: 10 });
      repository.countItemsByUser.mockResolvedValue(49);

      await expect(service.assertCanCreateItem('user-1')).resolves.toBeUndefined();
    });

    it('skips count for premium (infinite cap)', async () => {
      repository.getUserTier.mockResolvedValue('pro');
      tierConfig.get.mockReturnValue({
        maxLists: Infinity,
        maxItems: Infinity,
        maxAiCallsPerMonth: Infinity,
      });

      await service.assertCanCreateItem('user-1');

      expect(repository.countItemsByUser).not.toHaveBeenCalled();
    });
  });

  describe('getPlanUsage', () => {
    it('returns shaped usage for a free user with data', async () => {
      repository.getUserTier.mockResolvedValue('free');
      tierConfig.get.mockReturnValue({ maxLists: 3, maxItems: 50, maxAiCallsPerMonth: 10 });
      repository.getUserUsage.mockResolvedValue({ listCount: 2, itemCount: 30, aiCallCount: 5 });

      const result = await service.getPlanUsage('user-1');

      expect(result).toEqual({
        plan: 'free',
        lists: { used: 2, max: 3 },
        items: { used: 30, max: 50 },
        aiCalls: { used: 5, max: 10 },
      });
    });

    it('returns null max for all fields on premium tier', async () => {
      repository.getUserTier.mockResolvedValue('pro');
      tierConfig.get.mockReturnValue({
        maxLists: Infinity,
        maxItems: Infinity,
        maxAiCallsPerMonth: Infinity,
      });
      repository.getUserUsage.mockResolvedValue({ listCount: 10, itemCount: 200, aiCallCount: 50 });

      const result = await service.getPlanUsage('user-1');

      expect(result).toEqual({
        plan: 'pro',
        lists: { used: 10, max: null },
        items: { used: 200, max: null },
        aiCalls: { used: 50, max: null },
      });
    });

    it('returns zero AI call count when user has no ai_usages row', async () => {
      repository.getUserTier.mockResolvedValue('free');
      tierConfig.get.mockReturnValue({ maxLists: 3, maxItems: 50, maxAiCallsPerMonth: 10 });
      repository.getUserUsage.mockResolvedValue({ listCount: 0, itemCount: 0, aiCallCount: 0 });

      const result = await service.getPlanUsage('user-1');

      expect(result.aiCalls).toEqual({ used: 0, max: 10 });
    });
  });
});
