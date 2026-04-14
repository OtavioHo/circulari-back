import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { LocationsRepository } from './locations.repository';

describe('LocationsService', () => {
  let service: LocationsService;
  let repository: jest.Mocked<LocationsRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LocationsService,
        {
          provide: LocationsRepository,
          useValue: {
            search: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<LocationsService>(LocationsService);
    repository = module.get(LocationsRepository);
  });

  describe('update', () => {
    it('returns the updated location when found', async () => {
      repository.update.mockResolvedValue({ id: 'loc-1', name: 'Bedroom' });

      const result = await service.update('loc-1', 'user-1', 'Bedroom');

      expect(repository.update).toHaveBeenCalledWith('loc-1', 'user-1', 'Bedroom');
      expect(result).toEqual({ id: 'loc-1', name: 'Bedroom' });
    });

    it('throws NotFoundException when location not found or not owned', async () => {
      repository.update.mockResolvedValue(null);

      await expect(service.update('loc-999', 'user-1', 'Bedroom')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('delegates to repository when location is owned by user', async () => {
      repository.delete.mockResolvedValue(1);

      await service.remove('loc-1', 'user-1');

      expect(repository.delete).toHaveBeenCalledWith('loc-1', 'user-1');
    });

    it('throws NotFoundException when location not found or not owned', async () => {
      repository.delete.mockResolvedValue(0);

      await expect(service.remove('loc-999', 'user-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('search', () => {
    it('delegates to repository with userId and query', async () => {
      const locations = [{ id: 'loc-1', user_id: 'user-1', name: 'Bedroom' }];
      repository.search.mockResolvedValue(locations as any);

      const result = await service.search('user-1', 'Bed');

      expect(repository.search).toHaveBeenCalledWith('user-1', 'Bed');
      expect(result).toBe(locations);
    });

    it('delegates to repository with no query when omitted', async () => {
      repository.search.mockResolvedValue([]);

      await service.search('user-1');

      expect(repository.search).toHaveBeenCalledWith('user-1', undefined);
    });
  });

  describe('create', () => {
    it('delegates to repository with userId and name', async () => {
      const location = { id: 'loc-1', user_id: 'user-1', name: 'Bedroom' };
      repository.create.mockResolvedValue(location as any);

      const result = await service.create('user-1', 'Bedroom');

      expect(repository.create).toHaveBeenCalledWith('user-1', 'Bedroom');
      expect(result).toBe(location);
    });
  });
});
