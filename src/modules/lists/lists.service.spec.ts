import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ListsService } from './lists.service';
import { ListsRepository } from './lists.repository';
import { LimitsService } from '../tiers/limits.service';

describe('ListsService', () => {
  let service: ListsService;
  let repository: jest.Mocked<ListsRepository>;
  let limits: { withListCapLock: jest.Mock };

  beforeEach(async () => {
    limits = {
      withListCapLock: jest
        .fn()
        .mockImplementation(async (_userId: string, fn: (tx: unknown) => Promise<unknown>) =>
          fn(undefined),
        ),
    };

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
        {
          provide: LimitsService,
          useValue: limits,
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

    it('maps repository result to shaped list response', async () => {
      repository.findAllByUser.mockResolvedValue([
        {
          id: 'list-1',
          name: 'My List',
          location: null,
          user_id: 'user-1',
          created_at: new Date('2026-01-01'),
          _count: { items: 2 },
          total_value: 15.5,
        },
      ]);

      const result = await service.getAll('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].item_count).toBe(2);
      expect(result[0].total_value).toBe(15.5);
      expect(result[0].id).toBe('list-1');
      expect(result[0].name).toBe('My List');
      expect(result[0].location).toBeNull();
    });

    it('passes through zero total_value from repository', async () => {
      repository.findAllByUser.mockResolvedValue([
        {
          id: 'list-1',
          name: 'My List',
          location: null,
          user_id: 'user-1',
          created_at: new Date('2026-01-01'),
          _count: { items: 0 },
          total_value: 0,
        },
      ]);

      const result = await service.getAll('user-1');

      expect(result[0].total_value).toBe(0);
    });
  });

  describe('create', () => {
    it('rejects with ForbiddenException when list limit reached', async () => {
      limits.withListCapLock.mockRejectedValue(
        new ForbiddenException({ code: 'LIMIT_REACHED', limit: 3 }),
      );

      await expect(service.create('user-1', { name: 'New List' })).rejects.toThrow(
        ForbiddenException,
      );
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('delegates to repository and returns shaped list with zero aggregates', async () => {
      repository.create.mockResolvedValue({
        id: 'list-1',
        name: 'New List',
        location: null,
        user_id: 'user-1',
        created_at: new Date('2026-01-01'),
      });

      const result = await service.create('user-1', { name: 'New List' });

      expect(repository.create).toHaveBeenCalledWith('user-1', { name: 'New List' }, undefined);
      expect(result).toEqual({
        id: 'list-1',
        name: 'New List',
        location: null,
        item_count: 0,
        total_value: 0,
        created_at: new Date('2026-01-01'),
      });
    });

    it('includes location when provided', async () => {
      repository.create.mockResolvedValue({
        id: 'list-2',
        name: 'Garage',
        location: '123 Main St',
        user_id: 'user-1',
        created_at: new Date('2026-01-01'),
      });

      const result = await service.create('user-1', { name: 'Garage', location: '123 Main St' });

      expect(repository.create).toHaveBeenCalledWith(
        'user-1',
        { name: 'Garage', location: '123 Main St' },
        undefined,
      );
      expect(result.location).toBe('123 Main St');
    });
  });

  describe('rename', () => {
    it('returns the updated list when found', async () => {
      repository.update.mockResolvedValue({
        id: 'list-1',
        user_id: 'user-1',
        name: 'Updated Name',
        location: null,
        created_at: new Date('2026-01-01'),
      });

      const result = await service.rename('list-1', 'user-1', { name: 'Updated Name' });

      expect(repository.update).toHaveBeenCalledWith('list-1', 'user-1', { name: 'Updated Name' });
      expect(result).toMatchObject({ id: 'list-1', name: 'Updated Name', location: null });
    });

    it('returns the updated location when provided', async () => {
      repository.update.mockResolvedValue({
        id: 'list-1',
        user_id: 'user-1',
        name: 'My List',
        location: '456 Oak Ave',
        created_at: new Date('2026-01-01'),
      });

      const result = await service.rename('list-1', 'user-1', {
        name: 'My List',
        location: '456 Oak Ave',
      });

      expect(repository.update).toHaveBeenCalledWith('list-1', 'user-1', {
        name: 'My List',
        location: '456 Oak Ave',
      });
      expect(result.location).toBe('456 Oak Ave');
    });

    it('throws NotFoundException when list not found or not owned', async () => {
      repository.update.mockResolvedValue(null);

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
