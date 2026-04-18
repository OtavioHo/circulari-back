import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { LimitsService } from './limits.service';
import { LimitsRepository } from './limits.repository';
import { TierLimitsConfig } from './tier-limits.config';

describe('LimitsService', () => {
  let service: LimitsService;
  let repository: jest.Mocked<LimitsRepository>;
  let tierConfig: { get: jest.Mock };

  beforeEach(async () => {
    tierConfig = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LimitsService,
        {
          provide: LimitsRepository,
          useValue: {
            getUserTier: jest.fn(),
            countLists: jest.fn(),
            countItems: jest.fn(),
            getMonthlyAiCalls: jest.fn(),
            reserveAiCall: jest.fn(),
            releaseAiReservation: jest.fn(),
          },
        },
        {
          provide: TierLimitsConfig,
          useValue: tierConfig,
        },
      ],
    }).compile();

    service = module.get<LimitsService>(LimitsService);
    repository = module.get(LimitsRepository);
  });

  describe('assertCanCreateList', () => {
    it('throws LIMIT_REACHED when free user is at list cap', async () => {
      repository.getUserTier.mockResolvedValue('free');
      tierConfig.get.mockReturnValue({ maxLists: 3, maxItems: 50, maxAiCallsPerMonth: 10 });
      repository.countLists.mockResolvedValue(3);

      await expect(service.assertCanCreateList('user-1')).rejects.toThrow(ForbiddenException);
    });

    it('allows creation when below cap', async () => {
      repository.getUserTier.mockResolvedValue('free');
      tierConfig.get.mockReturnValue({ maxLists: 3, maxItems: 50, maxAiCallsPerMonth: 10 });
      repository.countLists.mockResolvedValue(2);

      await expect(service.assertCanCreateList('user-1')).resolves.toBeUndefined();
    });

    it('skips counting for premium (infinite cap)', async () => {
      repository.getUserTier.mockResolvedValue('premium');
      tierConfig.get.mockReturnValue({
        maxLists: Infinity,
        maxItems: Infinity,
        maxAiCallsPerMonth: Infinity,
      });

      await expect(service.assertCanCreateList('user-1')).resolves.toBeUndefined();
      expect(repository.countLists).not.toHaveBeenCalled();
    });
  });

  describe('assertCanCreateItem', () => {
    it('throws LIMIT_REACHED at item cap', async () => {
      repository.getUserTier.mockResolvedValue('free');
      tierConfig.get.mockReturnValue({ maxLists: 3, maxItems: 50, maxAiCallsPerMonth: 10 });
      repository.countItems.mockResolvedValue(50);

      await expect(service.assertCanCreateItem('user-1')).rejects.toThrow(ForbiddenException);
    });

    it('allows creation below cap', async () => {
      repository.getUserTier.mockResolvedValue('free');
      tierConfig.get.mockReturnValue({ maxLists: 3, maxItems: 50, maxAiCallsPerMonth: 10 });
      repository.countItems.mockResolvedValue(49);

      await expect(service.assertCanCreateItem('user-1')).resolves.toBeUndefined();
    });
  });

  describe('reserveAiCall', () => {
    it('throws LIMIT_REACHED when repository cannot reserve a slot', async () => {
      repository.getUserTier.mockResolvedValue('free');
      tierConfig.get.mockReturnValue({ maxLists: 3, maxItems: 50, maxAiCallsPerMonth: 10 });
      repository.reserveAiCall.mockResolvedValue(false);

      await expect(service.reserveAiCall('user-1')).rejects.toThrow(ForbiddenException);
    });

    it('resolves when repository reserves a slot', async () => {
      repository.getUserTier.mockResolvedValue('free');
      tierConfig.get.mockReturnValue({ maxLists: 3, maxItems: 50, maxAiCallsPerMonth: 10 });
      repository.reserveAiCall.mockResolvedValue(true);

      await expect(service.reserveAiCall('user-1')).resolves.toBeUndefined();
      const call = repository.reserveAiCall.mock.calls[0];
      expect(call[0]).toBe('user-1');
      expect(call[1]).toMatch(/^\d{4}-\d{2}$/);
      expect(call[2]).toBe(10);
    });

    it('skips reservation for premium (infinite cap)', async () => {
      repository.getUserTier.mockResolvedValue('premium');
      tierConfig.get.mockReturnValue({
        maxLists: Infinity,
        maxItems: Infinity,
        maxAiCallsPerMonth: Infinity,
      });

      await expect(service.reserveAiCall('user-1')).resolves.toBeUndefined();
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
    it('delegates to repository with userId and current month (YYYY-MM)', async () => {
      repository.getUserTier.mockResolvedValue('free');
      tierConfig.get.mockReturnValue({ maxLists: 3, maxItems: 50, maxAiCallsPerMonth: 10 });

      await service.releaseAiReservation('user-1');

      const call = repository.releaseAiReservation.mock.calls[0];
      expect(call[0]).toBe('user-1');
      expect(call[1]).toMatch(/^\d{4}-\d{2}$/);
    });

    it('is a no-op for premium users', async () => {
      repository.getUserTier.mockResolvedValue('premium');
      tierConfig.get.mockReturnValue({
        maxLists: Infinity,
        maxItems: Infinity,
        maxAiCallsPerMonth: Infinity,
      });

      await service.releaseAiReservation('user-1');
      expect(repository.releaseAiReservation).not.toHaveBeenCalled();
    });
  });
});
