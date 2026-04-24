import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { DashboardRepository } from './dashboard.repository';

describe('DashboardService', () => {
  let service: DashboardService;
  let repository: jest.Mocked<DashboardRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        {
          provide: DashboardRepository,
          useValue: { getSummary: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    repository = module.get(DashboardRepository);
  });

  describe('getSummary', () => {
    it('delegates to repository and returns result', async () => {
      const summary = { list_count: 2, item_count: 3, total_value: 300 };
      repository.getSummary.mockResolvedValue(summary);

      const result = await service.getSummary('user-1');

      expect(repository.getSummary).toHaveBeenCalledWith('user-1');
      expect(result).toBe(summary);
    });

    it('returns zeros when user has no data', async () => {
      const summary = { list_count: 0, item_count: 0, total_value: 0 };
      repository.getSummary.mockResolvedValue(summary);

      const result = await service.getSummary('user-1');

      expect(result).toEqual({ list_count: 0, item_count: 0, total_value: 0 });
    });
  });
});
