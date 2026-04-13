import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { ListsController } from './lists.controller';
import { ListsService } from './lists.service';

describe('ListsController', () => {
  let controller: ListsController;

  const mockListsService = {
    getAll: jest.fn(),
    create: jest.fn(),
    rename: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ListsController],
      providers: [{ provide: ListsService, useValue: mockListsService }],
    }).compile();

    controller = module.get<ListsController>(ListsController);
    jest.clearAllMocks();
  });

  const makeReq = (id: string) => ({ user: { id } }) as any;

  describe('getAll', () => {
    it('delegates to listsService.getAll with userId from req.user.id', async () => {
      const expected = [
        { id: 'list-1', name: 'My List', item_count: 0, total_value: 0, created_at: new Date() },
      ];
      mockListsService.getAll.mockResolvedValue(expected);

      const result = await controller.getAll(makeReq('user-1'));

      expect(mockListsService.getAll).toHaveBeenCalledWith('user-1');
      expect(result).toBe(expected);
    });

    it('is NOT marked @Public so JwtAuthGuard protects it', () => {
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, ListsController.prototype.getAll);
      expect(isPublic).toBeUndefined();
    });
  });

  describe('create', () => {
    it('delegates to listsService.create with userId and dto', async () => {
      const dto = { name: 'New List' };
      const expected = {
        id: 'list-1',
        name: 'New List',
        item_count: 0,
        total_value: 0,
        created_at: new Date(),
      };
      mockListsService.create.mockResolvedValue(expected);

      const result = await controller.create(makeReq('user-1'), dto);

      expect(mockListsService.create).toHaveBeenCalledWith('user-1', dto);
      expect(result).toBe(expected);
    });

    it('is NOT marked @Public so JwtAuthGuard protects it', () => {
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, ListsController.prototype.create);
      expect(isPublic).toBeUndefined();
    });
  });

  describe('rename', () => {
    it('delegates to listsService.rename with id, userId, and dto', async () => {
      const dto = { name: 'Updated Name' };
      mockListsService.rename.mockResolvedValue(undefined);

      await controller.rename(makeReq('user-1'), 'list-1', dto);

      expect(mockListsService.rename).toHaveBeenCalledWith('list-1', 'user-1', dto);
    });

    it('is NOT marked @Public so JwtAuthGuard protects it', () => {
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, ListsController.prototype.rename);
      expect(isPublic).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('delegates to listsService.remove with id and userId', async () => {
      mockListsService.remove.mockResolvedValue(undefined);

      await controller.remove(makeReq('user-1'), 'list-1');

      expect(mockListsService.remove).toHaveBeenCalledWith('list-1', 'user-1');
    });

    it('returns no body (undefined) for 204', async () => {
      mockListsService.remove.mockResolvedValue(undefined);

      const result = await controller.remove(makeReq('user-1'), 'list-1');

      expect(result).toBeUndefined();
    });

    it('is NOT marked @Public so JwtAuthGuard protects it', () => {
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, ListsController.prototype.remove);
      expect(isPublic).toBeUndefined();
    });
  });
});
