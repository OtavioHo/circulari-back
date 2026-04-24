import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { TiersController } from './tiers.controller';
import { LimitsService } from './limits.service';

describe('TiersController', () => {
  let controller: TiersController;

  const mockLimitsService = { getPlanUsage: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TiersController],
      providers: [{ provide: LimitsService, useValue: mockLimitsService }],
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
});
