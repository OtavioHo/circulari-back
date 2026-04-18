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
            incrementMonthlyAiCalls: jest.fn(),
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

  describe('assertCanUseAi', () => {
    it('throws LIMIT_REACHED at monthly AI cap', async () => {
      repository.getUserTier.mockResolvedValue('free');
      tierConfig.get.mockReturnValue({ maxLists: 3, maxItems: 50, maxAiCallsPerMonth: 10 });
      repository.getMonthlyAiCalls.mockResolvedValue(10);

      await expect(service.assertCanUseAi('user-1')).rejects.toThrow(ForbiddenException);
    });

    it('allows AI call below cap', async () => {
      repository.getUserTier.mockResolvedValue('free');
      tierConfig.get.mockReturnValue({ maxLists: 3, maxItems: 50, maxAiCallsPerMonth: 10 });
      repository.getMonthlyAiCalls.mockResolvedValue(9);

      await expect(service.assertCanUseAi('user-1')).resolves.toBeUndefined();
    });
  });

  describe('recordAiCall', () => {
    it('delegates to repository with userId and current month (YYYY-MM)', async () => {
      await service.recordAiCall('user-1');

      const call = repository.incrementMonthlyAiCalls.mock.calls[0];
      expect(call[0]).toBe('user-1');
      expect(call[1]).toMatch(/^\d{4}-\d{2}$/);
    });
  });
});
