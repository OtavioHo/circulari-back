import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ItemsService } from './items.service';
import { ItemsRepository } from './items.repository';
import { ListsRepository } from '../lists/lists.repository';
import { STORAGE_SERVICE } from '../storage/storage.interface';
import { Prisma } from '../../generated/prisma/client';
import { LimitsService } from '../tiers/limits.service';
import { ForbiddenException } from '@nestjs/common';

const makeItem = (overrides: Partial<ReturnType<typeof baseItem>> = {}) => ({
  ...baseItem(),
  ...overrides,
});

function baseItem() {
  return {
    id: 'item-1',
    list_id: 'list-1',
    name: 'My Item',
    description: null as string | null,
    quantity: 1,
    category_id: null as string | null,
    category: null as { id: string; name: string } | null,
    user_defined_value: null as { valueOf: () => number } | null,
    images: [] as {
      id: string;
      item_id: string;
      url: string;
      storage_key: string;
      is_main: boolean;
      created_at: Date;
    }[],
    created_at: new Date('2026-01-01'),
  };
}

const mockList = {
  id: 'list-1',
  user_id: 'user-1',
  name: 'My List',
  location: null,
  created_at: new Date(),
};

const fakeImageFile = (
  buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]),
): Express.Multer.File =>
  ({
    buffer: buf,
    mimetype: 'image/jpeg',
    originalname: 'photo.jpg',
    size: buf.length,
    fieldname: 'image',
    encoding: '7bit',
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
  }) as Express.Multer.File;

describe('ItemsService', () => {
  let service: ItemsService;
  let itemsRepository: jest.Mocked<ItemsRepository>;
  let listsRepository: jest.Mocked<ListsRepository>;
  let storageService: { upload: jest.Mock; getSignedUrl: jest.Mock };
  let limits: { assertCanCreateItem: jest.Mock };

  beforeEach(async () => {
    storageService = {
      upload: jest.fn(),
      getSignedUrl: jest.fn().mockImplementation(async (key: string) => `https://signed/${key}`),
    };
    limits = { assertCanCreateItem: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ItemsService,
        {
          provide: ItemsRepository,
          useValue: {
            create: jest.fn(),
            createWithImage: jest.fn(),
            findOneOwnedByUser: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            searchByUser: jest.fn(),
            findByList: jest.fn(),
            findAllCategories: jest.fn(),
          },
        },
        {
          provide: ListsRepository,
          useValue: {
            findOneByUser: jest.fn(),
          },
        },
        {
          provide: STORAGE_SERVICE,
          useValue: storageService,
        },
        {
          provide: LimitsService,
          useValue: limits,
        },
      ],
    }).compile();

    service = module.get<ItemsService>(ItemsService);
    itemsRepository = module.get(ItemsRepository);
    listsRepository = module.get(ListsRepository);
  });

  describe('create', () => {
    const dto = { list_id: 'list-1', name: 'My Item' };

    it('creates item without image when no file provided', async () => {
      listsRepository.findOneByUser.mockResolvedValue(mockList);
      itemsRepository.create.mockResolvedValue(makeItem() as any);

      const result = await service.create('user-1', dto);

      expect(itemsRepository.create).toHaveBeenCalledWith(dto);
      expect(storageService.upload).not.toHaveBeenCalled();
      expect(result).toEqual({
        id: 'item-1',
        name: 'My Item',
        description: null,
        quantity: 1,
        user_defined_value: null,
        category: null,
        images: [],
        created_at: new Date('2026-01-01'),
      });
    });

    it('uploads image and creates item + image record when file provided', async () => {
      listsRepository.findOneByUser.mockResolvedValue(mockList);
      storageService.upload.mockResolvedValue('https://cdn.example.com/items/item-1/abc.jpg');
      const itemWithImage = makeItem({
        images: [
          {
            id: 'img-1',
            item_id: 'item-1',
            url: 'https://cdn.example.com/items/item-1/abc.jpg',
            storage_key: 'items/item-1/abc.jpg',
            is_main: true,
            created_at: new Date(),
          },
        ],
      });
      itemsRepository.createWithImage.mockResolvedValue(itemWithImage as any);

      const result = await service.create('user-1', dto, fakeImageFile());

      expect(storageService.upload).toHaveBeenCalledTimes(1);
      expect(itemsRepository.createWithImage).toHaveBeenCalledTimes(1);
      expect(itemsRepository.create).not.toHaveBeenCalled();
      expect(result.images).toHaveLength(1);
      expect(result.images[0].is_main).toBe(true);
    });

    it('does not persist item when storage upload throws', async () => {
      listsRepository.findOneByUser.mockResolvedValue(mockList);
      storageService.upload.mockRejectedValue(new Error('S3 down'));

      await expect(service.create('user-1', dto, fakeImageFile())).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(itemsRepository.createWithImage).not.toHaveBeenCalled();
      expect(itemsRepository.create).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for invalid MIME type (magic bytes mismatch)', async () => {
      listsRepository.findOneByUser.mockResolvedValue(mockList);
      // Buffer that doesn't match any known magic bytes
      const badFile = fakeImageFile(Buffer.alloc(16, 0));

      await expect(service.create('user-1', dto, badFile)).rejects.toThrow(BadRequestException);
      expect(storageService.upload).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when list does not belong to caller', async () => {
      listsRepository.findOneByUser.mockResolvedValue(null);

      await expect(service.create('user-1', dto)).rejects.toThrow(NotFoundException);
      expect(itemsRepository.create).not.toHaveBeenCalled();
    });

    it('rejects with ForbiddenException when item limit reached', async () => {
      listsRepository.findOneByUser.mockResolvedValue(mockList);
      limits.assertCanCreateItem.mockRejectedValue(
        new ForbiddenException({ code: 'LIMIT_REACHED', limit: 50 }),
      );

      await expect(service.create('user-1', dto)).rejects.toThrow(ForbiddenException);
      expect(itemsRepository.create).not.toHaveBeenCalled();
    });

    it('includes category object in response when category_id is provided', async () => {
      const category = { id: '00000000-0000-0000-0000-000000000001', name: 'Eletrônicos' };
      listsRepository.findOneByUser.mockResolvedValue(mockList);
      itemsRepository.create.mockResolvedValue(
        makeItem({ category_id: category.id, category }) as any,
      );

      const result = await service.create('user-1', { ...dto, category_id: category.id });

      expect(result.category).toEqual(category);
    });

    it('converts user_defined_value Decimal to number in response', async () => {
      listsRepository.findOneByUser.mockResolvedValue(mockList);
      itemsRepository.create.mockResolvedValue(
        makeItem({ user_defined_value: { valueOf: () => 9.99 } as any }) as any,
      );

      const result = await service.create('user-1', { ...dto, user_defined_value: 9.99 });

      expect(result.user_defined_value).toBe(9.99);
    });

    it('throws BadRequestException when category_id does not exist (P2003)', async () => {
      listsRepository.findOneByUser.mockResolvedValue(mockList);
      const fkError = new Prisma.PrismaClientKnownRequestError('FK violation', {
        code: 'P2003',
        clientVersion: '0.0.0',
      });
      itemsRepository.create.mockRejectedValue(fkError);

      await expect(
        service.create('user-1', { ...dto, category_id: '00000000-0000-0000-0000-000000000099' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    const mockUpdatedItem = makeItem({ name: 'Updated' });

    it('returns the updated item when found', async () => {
      itemsRepository.findOneOwnedByUser.mockResolvedValue(makeItem() as any);
      itemsRepository.update.mockResolvedValue(mockUpdatedItem as any);

      const result = await service.update('item-1', 'user-1', { name: 'Updated' });

      expect(itemsRepository.update).toHaveBeenCalledWith(
        'item-1',
        'user-1',
        { name: 'Updated' },
        undefined,
      );
      expect(result).toMatchObject({ id: 'item-1', name: 'Updated', category: null, images: [] });
    });

    it('uploads new image and replaces main image record', async () => {
      itemsRepository.findOneOwnedByUser.mockResolvedValue(makeItem() as any);
      storageService.upload.mockResolvedValue('https://cdn.example.com/items/item-1/new.jpg');
      const itemWithNewImage = makeItem({
        name: 'Updated',
        images: [
          {
            id: 'img-2',
            item_id: 'item-1',
            url: 'https://cdn.example.com/items/item-1/new.jpg',
            storage_key: 'items/item-1/new.jpg',
            is_main: true,
            created_at: new Date(),
          },
        ],
      });
      itemsRepository.update.mockResolvedValue(itemWithNewImage as any);

      const result = await service.update('item-1', 'user-1', { name: 'Updated' }, fakeImageFile());

      expect(storageService.upload).toHaveBeenCalledTimes(1);
      expect(itemsRepository.update).toHaveBeenCalledWith(
        'item-1',
        'user-1',
        { name: 'Updated' },
        expect.objectContaining({ isMain: true }),
      );
      expect(result.images[0].is_main).toBe(true);
    });

    it('throws NotFoundException when item not found or not owned', async () => {
      itemsRepository.findOneOwnedByUser.mockResolvedValue(null);

      await expect(service.update('item-999', 'user-1', { name: 'x' })).rejects.toThrow(
        NotFoundException,
      );
      expect(storageService.upload).not.toHaveBeenCalled();
      expect(itemsRepository.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when category_id does not exist (P2003)', async () => {
      itemsRepository.findOneOwnedByUser.mockResolvedValue(makeItem() as any);
      const fkError = new Prisma.PrismaClientKnownRequestError('FK violation', {
        code: 'P2003',
        clientVersion: '0.0.0',
      });
      itemsRepository.update.mockRejectedValue(fkError);

      await expect(
        service.update('item-1', 'user-1', { category_id: '00000000-0000-0000-0000-000000000099' }),
      ).rejects.toThrow(BadRequestException);
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
      itemsRepository.searchByUser.mockResolvedValue([
        makeItem({ name: 'vintage lamp', created_at: createdAt }),
      ] as any);

      const result = await service.search('user-1', 'lamp');

      expect(itemsRepository.searchByUser).toHaveBeenCalledWith('user-1', 'lamp');
      expect(result).toEqual([
        {
          id: 'item-1',
          name: 'vintage lamp',
          description: null,
          quantity: 1,
          user_defined_value: null,
          category: null,
          images: [],
          created_at: createdAt,
        },
      ]);
    });

    it('converts user_defined_value Decimal to number in search results', async () => {
      itemsRepository.searchByUser.mockResolvedValue([
        makeItem({ user_defined_value: { valueOf: () => 5.5 } as any }),
      ] as any);

      const result = await service.search('user-1', 'lamp');

      expect(result[0].user_defined_value).toBe(5.5);
    });

    it('returns empty array when no items match', async () => {
      itemsRepository.searchByUser.mockResolvedValue([]);

      const result = await service.search('user-1', 'nonexistent');

      expect(result).toEqual([]);
    });
  });

  describe('findAllCategories', () => {
    it('delegates to repository and returns result as-is', async () => {
      const categories = [
        { id: 'cat-1', name: 'Eletrônicos' },
        { id: 'cat-2', name: 'Móveis' },
      ];
      itemsRepository.findAllCategories.mockResolvedValue(categories as any);

      const result = await service.findAllCategories();

      expect(itemsRepository.findAllCategories).toHaveBeenCalledTimes(1);
      expect(result).toBe(categories);
    });

    it('returns empty array when no categories exist', async () => {
      itemsRepository.findAllCategories.mockResolvedValue([]);

      const result = await service.findAllCategories();

      expect(result).toEqual([]);
    });
  });

  describe('getByList', () => {
    const makeListItem = (id: string, createdAt = new Date()) =>
      makeItem({ id, list_id: 'list-1', name: `Item ${id}`, created_at: createdAt });

    it('throws NotFoundException when list does not belong to caller', async () => {
      listsRepository.findOneByUser.mockResolvedValue(null);

      await expect(service.getByList('list-1', 'user-1')).rejects.toThrow(NotFoundException);
      expect(itemsRepository.findByList).not.toHaveBeenCalled();
    });

    it('returns first page with nextCursor set when more items exist', async () => {
      listsRepository.findOneByUser.mockResolvedValue(mockList);
      const rows = Array.from({ length: 21 }, (_, i) => makeListItem(`item-${i}`));
      itemsRepository.findByList.mockResolvedValue(rows as any);

      const result = await service.getByList('list-1', 'user-1', undefined, 20);

      expect(itemsRepository.findByList).toHaveBeenCalledWith('list-1', 'user-1', undefined, 20);
      expect(result.data).toHaveLength(20);
      expect(result.nextCursor).toBe('item-19');
    });

    it('returns last page with nextCursor null when no more items', async () => {
      listsRepository.findOneByUser.mockResolvedValue(mockList);
      itemsRepository.findByList.mockResolvedValue([
        makeListItem('item-1'),
        makeListItem('item-2'),
      ] as any);

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
      itemsRepository.findByList.mockResolvedValue([makeListItem('item-5')] as any);

      await service.getByList('list-1', 'user-1', 'cursor-abc', 10);

      expect(itemsRepository.findByList).toHaveBeenCalledWith('list-1', 'user-1', 'cursor-abc', 10);
    });

    it('converts user_defined_value Decimal to number', async () => {
      listsRepository.findOneByUser.mockResolvedValue(mockList);
      itemsRepository.findByList.mockResolvedValue([
        makeItem({ user_defined_value: { valueOf: () => 12.5 } as any }),
      ] as any);

      const result = await service.getByList('list-1', 'user-1');

      expect(result.data[0].user_defined_value).toBe(12.5);
    });
  });
});
