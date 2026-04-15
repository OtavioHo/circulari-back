import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';

describe('ItemsController', () => {
  let controller: ItemsController;

  const mockItemsService = {
    search: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ItemsController],
      providers: [{ provide: ItemsService, useValue: mockItemsService }],
    }).compile();

    controller = module.get<ItemsController>(ItemsController);
    jest.clearAllMocks();
  });

  const makeReq = (id: string) => ({ user: { id } }) as any;

  describe('search', () => {
    it('delegates to itemsService.search with userId and query', async () => {
      const expected = [{ id: 'item-1', name: 'lamp' }];
      mockItemsService.search.mockResolvedValue(expected);

      const result = await controller.search('lamp', makeReq('user-1'));

      expect(mockItemsService.search).toHaveBeenCalledWith('user-1', 'lamp');
      expect(result).toBe(expected);
    });

    it('defaults query to empty string when not provided', async () => {
      mockItemsService.search.mockResolvedValue([]);

      await controller.search(undefined as any, makeReq('user-1'));

      expect(mockItemsService.search).toHaveBeenCalledWith('user-1', '');
    });

    it('is NOT marked @Public so JwtAuthGuard protects it', () => {
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, ItemsController.prototype.search);
      expect(isPublic).toBeUndefined();
    });
  });

  describe('create', () => {
    it('delegates to itemsService.create with userId and dto', async () => {
      const dto = { list_id: 'list-1', name: 'My Item' };
      const expected = { id: 'item-1', name: 'My Item', images: [], created_at: new Date() };
      mockItemsService.create.mockResolvedValue(expected);

      const result = await controller.create(dto as any, makeReq('user-1'), undefined);

      expect(mockItemsService.create).toHaveBeenCalledWith('user-1', dto, undefined);
      expect(result).toBe(expected);
    });

    it('is NOT marked @Public so JwtAuthGuard protects it', () => {
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, ItemsController.prototype.create);
      expect(isPublic).toBeUndefined();
    });
  });

  describe('update', () => {
    it('delegates to itemsService.update with id, userId, and dto', async () => {
      const dto = { name: 'Updated' };
      mockItemsService.update.mockResolvedValue(undefined);

      await controller.update('item-1', dto as any, makeReq('user-1'), undefined);

      expect(mockItemsService.update).toHaveBeenCalledWith('item-1', 'user-1', dto, undefined);
    });

    it('is NOT marked @Public so JwtAuthGuard protects it', () => {
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, ItemsController.prototype.update);
      expect(isPublic).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('delegates to itemsService.remove with id and userId', async () => {
      mockItemsService.remove.mockResolvedValue(undefined);

      await controller.remove('item-1', makeReq('user-1'));

      expect(mockItemsService.remove).toHaveBeenCalledWith('item-1', 'user-1');
    });

    it('returns no body (undefined) for 204', async () => {
      mockItemsService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('item-1', makeReq('user-1'));

      expect(result).toBeUndefined();
    });

    it('is NOT marked @Public so JwtAuthGuard protects it', () => {
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, ItemsController.prototype.remove);
      expect(isPublic).toBeUndefined();
    });
  });
});
