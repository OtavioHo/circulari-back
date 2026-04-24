import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

describe('DashboardController', () => {
  let controller: DashboardController;

  const mockDashboardService = { getSummary: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: mockDashboardService }],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
    jest.clearAllMocks();
  });

  const makeReq = (id: string) => ({ user: { id } }) as any;

  describe('summary', () => {
    it('delegates to dashboardService.getSummary with userId from req.user.id', async () => {
      const expected = { list_count: 2, item_count: 3, total_value: 300 };
      mockDashboardService.getSummary.mockResolvedValue(expected);

      const result = await controller.summary(makeReq('user-1'));

      expect(mockDashboardService.getSummary).toHaveBeenCalledWith('user-1');
      expect(result).toBe(expected);
    });

    it('is NOT marked @Public so JwtAuthGuard protects it', () => {
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, DashboardController.prototype.summary);
      expect(isPublic).toBeUndefined();
    });
  });
});
