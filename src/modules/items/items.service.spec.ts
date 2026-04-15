import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ItemsService } from './items.service';
import { ItemsRepository } from './items.repository';
import { ListsRepository } from '../lists/lists.repository';

describe('ItemsService', () => {
  let service: ItemsService;
  let itemsRepository: jest.Mocked<ItemsRepository>;
  let listsRepository: jest.Mocked<ListsRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ItemsService,
        {
          provide: ItemsRepository,
          useValue: {
            create: jest.fn(),
            findOneOwnedByUser: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            searchByUser: jest.fn(),
            findByList: jest.fn(),
          },
        },
        {
          provide: ListsRepository,
          useValue: {
            findOneByUser: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ItemsService>(ItemsService);
    itemsRepository = module.get(ItemsRepository);
    listsRepository = module.get(ListsRepository);
  });

  describe('create', () => {
    const dto = { list_id: 'list-1', name: 'My Item' };
    const mockItem = {
      id: 'item-1',
      list_id: 'list-1',
      name: 'My Item',
      description: null,
      quantity: 1,
      user_defined_value: null,
      created_at: new Date('2026-01-01'),
    };

    it('creates item when list belongs to caller', async () => {
      listsRepository.findOneByUser.mockResolvedValue({
        id: 'list-1',
        user_id: 'user-1',
        name: 'My List',
        location: null,
        created_at: new Date(),
      });
      itemsRepository.create.mockResolvedValue(mockItem);

      const result = await service.create('user-1', dto);

      expect(listsRepository.findOneByUser).toHaveBeenCalledWith('list-1', 'user-1');
      expect(itemsRepository.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual({
        id: 'item-1',
        name: 'My Item',
        description: null,
        quantity: 1,
        user_defined_value: null,
        images: [],
        created_at: new Date('2026-01-01'),
      });
    });

    it('throws NotFoundException when list does not belong to caller', async () => {
      listsRepository.findOneByUser.mockResolvedValue(null);

      await expect(service.create('user-1', dto)).rejects.toThrow(NotFoundException);
      expect(itemsRepository.create).not.toHaveBeenCalled();
    });

    it('converts user_defined_value Decimal to number in response', async () => {
      listsRepository.findOneByUser.mockResolvedValue({
        id: 'list-1',
        user_id: 'user-1',
        name: 'My List',
        location: null,
        created_at: new Date(),
      });
      itemsRepository.create.mockResolvedValue({
        ...mockItem,
        user_defined_value: { valueOf: () => 9.99 } as any,
      });

      const result = await service.create('user-1', { ...dto, user_defined_value: 9.99 });

      expect(result.user_defined_value).toBe(9.99);
    });
  });

  describe('update', () => {
    const mockUpdatedItem = {
      id: 'item-1',
      list_id: 'list-1',
      name: 'Updated',
      description: null,
      quantity: 1,
      user_defined_value: null,
      created_at: new Date(),
    };

    it('returns the updated item when found', async () => {
      itemsRepository.update.mockResolvedValue(mockUpdatedItem);

      const result = await service.update('item-1', 'user-1', { name: 'Updated' });

      expect(itemsRepository.update).toHaveBeenCalledWith('item-1', 'user-1', { name: 'Updated' });
      expect(result).toMatchObject({ id: 'item-1', name: 'Updated', images: [] });
    });

    it('throws NotFoundException when item not found or not owned', async () => {
      itemsRepository.update.mockResolvedValue(null);

      await expect(service.update('item-999', 'user-1', { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('delegates to repository when item is owned by user', async () => {
      itemsRepository.delete.mockResolvedValue(1);

      await service.remove('item-1', 'user-1');

      expect(itemsRepository.delete).toHaveBeenCalledWith('item-1', 'user-1');
    });

    it('throws NotFoundException when item not found or not owned', async () => {
      itemsRepository.delete.mockResolvedValue(0);

      await expect(service.remove('item-999', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('search', () => {
    it('delegates to repository with userId and query and returns mapped response', async () => {
      const createdAt = new Date();
      const items = [
        {
          id: 'item-1',
          list_id: 'list-1',
          name: 'vintage lamp',
          description: null,
          quantity: 1,
          user_defined_value: null,
          created_at: createdAt,
        },
      ];
      itemsRepository.searchByUser.mockResolvedValue(items);

      const result = await service.search('user-1', 'lamp');

      expect(itemsRepository.searchByUser).toHaveBeenCalledWith('user-1', 'lamp');
      expect(result).toEqual([
        {
          id: 'item-1',
          name: 'vintage lamp',
          description: null,
          quantity: 1,
          user_defined_value: null,
          images: [],
          created_at: createdAt,
        },
      ]);
    });

    it('converts user_defined_value Decimal to number in search results', async () => {
      const createdAt = new Date();
      itemsRepository.searchByUser.mockResolvedValue([
        {
          id: 'item-1',
          list_id: 'list-1',
          name: 'lamp',
          description: null,
          quantity: 1,
          user_defined_value: { valueOf: () => 5.5 } as any,
          created_at: createdAt,
        },
      ]);

      const result = await service.search('user-1', 'lamp');

      expect(result[0].user_defined_value).toBe(5.5);
    });

    it('returns empty array when no items match', async () => {
      itemsRepository.searchByUser.mockResolvedValue([]);

      const result = await service.search('user-1', 'nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('getByList', () => {
    const mockList = { id: 'list-1', user_id: 'user-1', name: 'My List', location: null, created_at: new Date() };
    const makeItem = (id: string, createdAt = new Date()) => ({
      id,
      list_id: 'list-1',
      name: `Item ${id}`,
      description: null,
      quantity: 1,
      location: null,
      user_defined_value: null,
      created_at: createdAt,
    });

    it('throws NotFoundException when list does not belong to caller', async () => {
      listsRepository.findOneByUser.mockResolvedValue(null);

      await expect(service.getByList('list-1', 'user-1')).rejects.toThrow(NotFoundException);
      expect(itemsRepository.findByList).not.toHaveBeenCalled();
    });

    it('returns first page with nextCursor set when more items exist', async () => {
      listsRepository.findOneByUser.mockResolvedValue(mockList);
      const rows = Array.from({ length: 21 }, (_, i) => makeItem(`item-${i}`));
      itemsRepository.findByList.mockResolvedValue(rows);

      const result = await service.getByList('list-1', 'user-1', undefined, 20);

      expect(itemsRepository.findByList).toHaveBeenCalledWith('list-1', 'user-1', undefined, 20);
      expect(result.data).toHaveLength(20);
      expect(result.nextCursor).toBe('item-19');
    });

    it('returns last page with nextCursor null when no more items', async () => {
      listsRepository.findOneByUser.mockResolvedValue(mockList);
      const rows = [makeItem('item-1'), makeItem('item-2')];
      itemsRepository.findByList.mockResolvedValue(rows);

      const result = await service.getByList('list-1', 'user-1', 'cursor-id', 20);

      expect(result.data).toHaveLength(2);
      expect(result.nextCursor).toBeNull();
    });

    it('returns empty data with nextCursor null for empty list', async () => {
      listsRepository.findOneByUser.mockResolvedValue(mockList);
      itemsRepository.findByList.mockResolvedValue([]);

      const result = await service.getByList('list-1', 'user-1');

      expect(result.data).toEqual([]);
      expect(result.nextCursor).toBeNull();
    });

    it('passes cursor to repository when provided', async () => {
      listsRepository.findOneByUser.mockResolvedValue(mockList);
      itemsRepository.findByList.mockResolvedValue([makeItem('item-5')]);

      await service.getByList('list-1', 'user-1', 'cursor-abc', 10);

      expect(itemsRepository.findByList).toHaveBeenCalledWith('list-1', 'user-1', 'cursor-abc', 10);
    });

    it('converts user_defined_value Decimal to number', async () => {
      listsRepository.findOneByUser.mockResolvedValue(mockList);
      itemsRepository.findByList.mockResolvedValue([
        { ...makeItem('item-1'), user_defined_value: { valueOf: () => 12.5 } as any },
      ]);

      const result = await service.getByList('list-1', 'user-1');

      expect(result.data[0].user_defined_value).toBe(12.5);
    });
  });
});
