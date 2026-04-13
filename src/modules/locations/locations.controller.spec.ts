import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

describe('LocationsController', () => {
  let controller: LocationsController;

  const mockLocationsService = {
    search: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LocationsController],
      providers: [{ provide: LocationsService, useValue: mockLocationsService }],
    }).compile();

    controller = module.get<LocationsController>(LocationsController);
    jest.clearAllMocks();
  });

  const makeReq = (id: string) => ({ user: { id } }) as any;

  describe('search', () => {
    it('delegates to locationsService.search with userId and query', async () => {
      const expected = [{ id: 'loc-1', name: 'Bedroom' }];
      mockLocationsService.search.mockResolvedValue(expected);

      const result = await controller.search('Bed', makeReq('user-1'));

      expect(mockLocationsService.search).toHaveBeenCalledWith('user-1', 'Bed');
      expect(result).toBe(expected);
    });

    it('passes undefined query when not provided', async () => {
      mockLocationsService.search.mockResolvedValue([]);

      await controller.search(undefined, makeReq('user-1'));

      expect(mockLocationsService.search).toHaveBeenCalledWith('user-1', undefined);
    });

    it('is NOT marked @Public so JwtAuthGuard protects it', () => {
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, LocationsController.prototype.search);
      expect(isPublic).toBeUndefined();
    });
  });

  describe('create', () => {
    it('delegates to locationsService.create with userId and name', async () => {
      const dto = { name: 'Bedroom' };
      const expected = { id: 'loc-1', name: 'Bedroom' };
      mockLocationsService.create.mockResolvedValue(expected);

      const result = await controller.create(dto as any, makeReq('user-1'));

      expect(mockLocationsService.create).toHaveBeenCalledWith('user-1', 'Bedroom');
      expect(result).toBe(expected);
    });

    it('is NOT marked @Public so JwtAuthGuard protects it', () => {
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, LocationsController.prototype.create);
      expect(isPublic).toBeUndefined();
    });
  });

  describe('rename', () => {
    it('delegates to locationsService.update with id, userId, and name', async () => {
      const dto = { name: 'Living Room' };
      mockLocationsService.update.mockResolvedValue(undefined);

      await controller.rename('loc-1', dto as any, makeReq('user-1'));

      expect(mockLocationsService.update).toHaveBeenCalledWith('loc-1', 'user-1', 'Living Room');
    });

    it('is NOT marked @Public so JwtAuthGuard protects it', () => {
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, LocationsController.prototype.rename);
      expect(isPublic).toBeUndefined();
    });
  });

  describe('remove', () => {
    it('delegates to locationsService.remove with id and userId', async () => {
      mockLocationsService.remove.mockResolvedValue(undefined);

      await controller.remove('loc-1', makeReq('user-1'));

      expect(mockLocationsService.remove).toHaveBeenCalledWith('loc-1', 'user-1');
    });

    it('returns no body (undefined) for 204', async () => {
      mockLocationsService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('loc-1', makeReq('user-1'));

      expect(result).toBeUndefined();
    });

    it('is NOT marked @Public so JwtAuthGuard protects it', () => {
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, LocationsController.prototype.remove);
      expect(isPublic).toBeUndefined();
    });
  });
});
