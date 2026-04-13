import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ListsService } from './lists.service';
import { ListsRepository } from './lists.repository';

describe('ListsService', () => {
  let service: ListsService;
  let repository: jest.Mocked<ListsRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ListsService,
        {
          provide: ListsRepository,
          useValue: {
            findAllByUser: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ListsService>(ListsService);
    repository = module.get(ListsRepository);
  });

  describe('getAll', () => {
    it('returns empty array when user has no lists', async () => {
      repository.findAllByUser.mockResolvedValue([]);

      const result = await service.getAll('user-1');

      expect(result).toEqual([]);
    });

    it('maps _count.items to item_count and sums user_defined_value to total_value', async () => {
      repository.findAllByUser.mockResolvedValue([
        {
          id: 'list-1',
          name: 'My List',
          user_id: 'user-1',
          created_at: new Date('2026-01-01'),
          _count: { items: 2 },
          items: [{ user_defined_value: 10.5 as any }, { user_defined_value: 5.0 as any }],
        },
      ]);

      const result = await service.getAll('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].item_count).toBe(2);
      expect(result[0].total_value).toBeCloseTo(15.5);
      expect(result[0].id).toBe('list-1');
      expect(result[0].name).toBe('My List');
    });

    it('treats null user_defined_value as 0 in total_value', async () => {
      repository.findAllByUser.mockResolvedValue([
        {
          id: 'list-1',
          name: 'My List',
          user_id: 'user-1',
          created_at: new Date('2026-01-01'),
          _count: { items: 2 },
          items: [{ user_defined_value: null as any }, { user_defined_value: 7.0 as any }],
        },
      ]);

      const result = await service.getAll('user-1');

      expect(result[0].total_value).toBeCloseTo(7.0);
    });
  });

  describe('create', () => {
    it('delegates to repository and returns shaped list with zero aggregates', async () => {
      repository.create.mockResolvedValue({
        id: 'list-1',
        name: 'New List',
        user_id: 'user-1',
        created_at: new Date('2026-01-01'),
      });

      const result = await service.create('user-1', { name: 'New List' });

      expect(repository.create).toHaveBeenCalledWith('user-1', 'New List');
      expect(result).toEqual({
        id: 'list-1',
        name: 'New List',
        item_count: 0,
        total_value: 0,
        created_at: new Date('2026-01-01'),
      });
    });
  });

  describe('rename', () => {
    it('delegates to repository when list exists', async () => {
      repository.update.mockResolvedValue(1);

      await service.rename('list-1', 'user-1', { name: 'Updated Name' });

      expect(repository.update).toHaveBeenCalledWith('list-1', 'user-1', 'Updated Name');
    });

    it('throws NotFoundException when list not found or not owned', async () => {
      repository.update.mockResolvedValue(0);

      await expect(service.rename('list-999', 'user-1', { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('delegates to repository when list exists', async () => {
      repository.delete.mockResolvedValue(1);

      await service.remove('list-1', 'user-1');

      expect(repository.delete).toHaveBeenCalledWith('list-1', 'user-1');
    });

    it('throws NotFoundException when list not found or not owned', async () => {
      repository.delete.mockResolvedValue(0);

      await expect(service.remove('list-999', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });
});
