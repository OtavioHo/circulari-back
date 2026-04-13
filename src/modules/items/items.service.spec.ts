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
      location_id: null,
      user_defined_value: null,
      created_at: new Date('2026-01-01'),
    };

    it('creates item when list belongs to caller', async () => {
      listsRepository.findOneByUser.mockResolvedValue({
        id: 'list-1',
        user_id: 'user-1',
        name: 'My List',
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
    it('delegates to repository when item is owned by user', async () => {
      itemsRepository.update.mockResolvedValue(1);

      await service.update('item-1', 'user-1', { name: 'Updated' });

      expect(itemsRepository.update).toHaveBeenCalledWith('item-1', 'user-1', { name: 'Updated' });
    });

    it('throws NotFoundException when item not found or not owned', async () => {
      itemsRepository.update.mockResolvedValue(0);

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
          location_id: null,
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
          location_id: null,
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
});
