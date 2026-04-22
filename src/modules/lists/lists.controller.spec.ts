import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { ListsController } from './lists.controller';
import { ListsService } from './lists.service';
import { ItemsService } from '../items/items.service';

describe('ListsController', () => {
  let controller: ListsController;

  const mockListsService = {
    getColors: jest.fn(),
    getIcons: jest.fn(),
    getPictures: jest.fn(),
    getAll: jest.fn(),
    create: jest.fn(),
    rename: jest.fn(),
    remove: jest.fn(),
  };

  const mockItemsService = {
    getByList: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ListsController],
      providers: [
        { provide: ListsService, useValue: mockListsService },
        { provide: ItemsService, useValue: mockItemsService },
      ],
    }).compile();

    controller = module.get<ListsController>(ListsController);
    jest.clearAllMocks();
  });

  const makeReq = (id: string) => ({ user: { id } }) as any;

  describe('getColors', () => {
    it('delegates to listsService.getColors', async () => {
      const colors = [{ id: 'color-1', name: 'Vermelho', hex_code: '#EF4444', order: 0 }];
      mockListsService.getColors.mockResolvedValue(colors);

      const result = await controller.getColors();

      expect(mockListsService.getColors).toHaveBeenCalled();
      expect(result).toBe(colors);
    });

    it('is NOT marked @Public so JwtAuthGuard protects it', () => {
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, ListsController.prototype.getColors);
      expect(isPublic).toBeUndefined();
    });
  });

  describe('getIcons', () => {
    it('delegates to listsService.getIcons', async () => {
      const icons = [{ id: 'icon-1', name: 'Lista', slug: 'list', order: 0 }];
      mockListsService.getIcons.mockResolvedValue(icons);

      const result = await controller.getIcons();

      expect(mockListsService.getIcons).toHaveBeenCalled();
      expect(result).toBe(icons);
    });

    it('is NOT marked @Public so JwtAuthGuard protects it', () => {
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, ListsController.prototype.getIcons);
      expect(isPublic).toBeUndefined();
    });
  });

  describe('getPictures', () => {
    it('delegates to listsService.getPictures', async () => {
      const pictures = [{ id: 'pic-1', slug: 'storage', order: 0 }];
      mockListsService.getPictures.mockResolvedValue(pictures);

      const result = await controller.getPictures();

      expect(mockListsService.getPictures).toHaveBeenCalled();
      expect(result).toBe(pictures);
    });

    it('is NOT marked @Public so JwtAuthGuard protects it', () => {
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, ListsController.prototype.getPictures);
      expect(isPublic).toBeUndefined();
    });
  });

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
      const dto = { name: 'New List', color_id: 'color-1', icon_id: 'icon-1', picture_id: 'pic-1' };
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

  describe('getItems', () => {
    it('delegates to itemsService.getByList with listId, userId, cursor, and limit', async () => {
      const expected = { data: [], nextCursor: null };
      mockItemsService.getByList.mockResolvedValue(expected);

      const result = await controller.getItems(
        'list-1',
        { cursor: 'cursor-abc', limit: 10 },
        makeReq('user-1'),
      );

      expect(mockItemsService.getByList).toHaveBeenCalledWith('list-1', 'user-1', 'cursor-abc', 10);
      expect(result).toBe(expected);
    });

    it('delegates with undefined cursor and default limit when not provided', async () => {
      const expected = { data: [], nextCursor: null };
      mockItemsService.getByList.mockResolvedValue(expected);

      await controller.getItems('list-1', {}, makeReq('user-1'));

      expect(mockItemsService.getByList).toHaveBeenCalledWith(
        'list-1',
        'user-1',
        undefined,
        undefined,
      );
    });

    it('is NOT marked @Public so JwtAuthGuard protects it', () => {
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, ListsController.prototype.getItems);
      expect(isPublic).toBeUndefined();
    });
  });
});
