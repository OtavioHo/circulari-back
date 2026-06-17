import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { TiersController } from './tiers.controller';
import { LimitsService } from './limits.service';
import { RevenueCatService } from '../revenuecat/revenuecat.service';

describe('TiersController', () => {
  let controller: TiersController;

  const mockLimitsService = { getPlanUsage: jest.fn() };
  const mockRevenueCat = { reconcileUser: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }])],
      controllers: [TiersController],
      providers: [
        { provide: LimitsService, useValue: mockLimitsService },
        { provide: RevenueCatService, useValue: mockRevenueCat },
        // Disable the global throttler guard so unit calls aren't rate-limited.
        { provide: APP_GUARD, useValue: { canActivate: () => true } },
      ],
    }).compile();

    controller = module.get<TiersController>(TiersController);
    jest.clearAllMocks();
  });

  const makeReq = (id: string) => ({ user: { id } }) as any;

  describe('getPlanUsage', () => {
    it('delegates to limitsService.getPlanUsage with userId from req.user.id', async () => {
      const expected = {
        plan: 'free',
        lists: { used: 1, max: 3 },
        items: { used: 10, max: 50 },
        aiCalls: { used: 2, max: 10 },
      };
      mockLimitsService.getPlanUsage.mockResolvedValue(expected);

      const result = await controller.getPlanUsage(makeReq('user-1'));

      expect(mockLimitsService.getPlanUsage).toHaveBeenCalledWith('user-1');
      expect(result).toBe(expected);
    });

    it('is NOT marked @Public so JwtAuthGuard protects it', () => {
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, TiersController.prototype.getPlanUsage);
      expect(isPublic).toBeUndefined();
    });
  });

  describe('reconcile', () => {
    it('awaits reconcileUser then returns fresh plan usage', async () => {
      const order: string[] = [];
      mockRevenueCat.reconcileUser.mockImplementation(async () => {
        order.push('reconcile');
      });
      const usage = { plan: 'pro', lists: { used: 2, max: 5 } };
      mockLimitsService.getPlanUsage.mockImplementation(async () => {
        order.push('usage');
        return usage;
      });

      const result = await controller.reconcile(makeReq('user-1'));

      expect(mockRevenueCat.reconcileUser).toHaveBeenCalledWith('user-1');
      expect(mockLimitsService.getPlanUsage).toHaveBeenCalledWith('user-1');
      expect(order).toEqual(['reconcile', 'usage']); // reconcile completes before usage is read
      expect(result).toBe(usage);
    });

    it('is NOT marked @Public so JwtAuthGuard protects it', () => {
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, TiersController.prototype.reconcile);
      expect(isPublic).toBeUndefined();
    });
  });
});
