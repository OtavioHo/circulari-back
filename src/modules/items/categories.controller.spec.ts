import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { CategoriesController } from './categories.controller';
import { ItemsService } from './items.service';

describe('CategoriesController', () => {
  let controller: CategoriesController;

  const mockItemsService = {
    findAllCategories: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CategoriesController],
      providers: [{ provide: ItemsService, useValue: mockItemsService }],
    }).compile();

    controller = module.get<CategoriesController>(CategoriesController);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('delegates to itemsService.findAllCategories and returns its result', async () => {
      const categories = [
        { id: 'cat-1', name: 'Eletrônicos' },
        { id: 'cat-2', name: 'Móveis' },
      ];
      mockItemsService.findAllCategories.mockResolvedValue(categories);

      const result = await controller.findAll();

      expect(mockItemsService.findAllCategories).toHaveBeenCalledTimes(1);
      expect(result).toBe(categories);
    });

    it('returns empty array when no categories exist', async () => {
      mockItemsService.findAllCategories.mockResolvedValue([]);

      const result = await controller.findAll();

      expect(result).toEqual([]);
    });

    it('is NOT marked @Public so JwtAuthGuard protects it', () => {
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, CategoriesController.prototype.findAll);
      expect(isPublic).toBeUndefined();
    });
  });
});
