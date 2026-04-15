import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ItemsRepository } from './items.repository';
import { ListsRepository } from '../lists/lists.repository';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { Prisma } from '../../generated/prisma/client';
import { IStorageService, STORAGE_SERVICE } from '../storage/storage.interface';
import { validateImageMagicBytes } from '../../common/utils/image-validation';

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };
  return map[mime] ?? 'bin';
}

@Injectable()
export class ItemsService {
  constructor(
    private readonly repository: ItemsRepository,
    private readonly listsRepository: ListsRepository,
    @Inject(STORAGE_SERVICE) private readonly storage: IStorageService,
  ) {}

  private rethrowFkError(err: unknown): never {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
      throw new BadRequestException('Invalid category_id: category not found');
    }
    throw err;
  }

  private mapItem(item: Awaited<ReturnType<ItemsRepository['create']>>) {
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      user_defined_value: item.user_defined_value != null ? Number(item.user_defined_value) : null,
      category: item.category ?? null,
      images: item.images.map((img) => ({ url: img.url, is_main: img.is_main })),
      created_at: item.created_at,
    };
  }

  async create(userId: string, dto: CreateItemDto, imageFile?: Express.Multer.File) {
    const list = await this.listsRepository.findOneByUser(dto.list_id, userId);
    if (!list) {
      throw new NotFoundException('List not found');
    }

    let imagePayload: { url: string; storageKey: string; isMain: true } | undefined;

    if (imageFile) {
      const actualMime = validateImageMagicBytes(imageFile.buffer);
      const itemId = randomUUID();
      const key = `items/${itemId}/${randomUUID()}.${extFromMime(actualMime)}`;
      let url: string;
      try {
        url = await this.storage.upload(imageFile.buffer, key, actualMime);
      } catch {
        throw new InternalServerErrorException('Image upload failed');
      }
      imagePayload = { url, storageKey: key, isMain: true };

      try {
        const item = await this.repository.createWithImage(dto, itemId, imagePayload);
        return this.mapItem(item);
      } catch (err) {
        const storageWithDelete = this.storage as IStorageService & {
          delete?: (key: string) => Promise<void>;
        };

        try {
          await storageWithDelete.delete?.(key);
        } catch {
          // Best-effort cleanup; preserve the original repository error.
        }

        this.rethrowFkError(err);
      }
    }

    const item = await this.repository.create(dto).catch((err) => this.rethrowFkError(err));
    return this.mapItem(item);
  }

  async update(id: string, userId: string, dto: UpdateItemDto, imageFile?: Express.Multer.File) {
    let imagePayload: { url: string; storageKey: string; isMain: true } | undefined;

    if (imageFile) {
      const actualMime = validateImageMagicBytes(imageFile.buffer);
      const key = `items/${id}/${randomUUID()}.${extFromMime(actualMime)}`;
      let url: string;
      try {
        url = await this.storage.upload(imageFile.buffer, key, actualMime);
      } catch {
        throw new InternalServerErrorException('Image upload failed');
      }
      imagePayload = { url, storageKey: key, isMain: true };
    }

    const item = await this.repository
      .update(id, userId, dto, imagePayload)
      .catch((err) => this.rethrowFkError(err));
    if (!item) {
      throw new NotFoundException('Item not found');
    }
    return this.mapItem(item);
  }

  async remove(id: string, userId: string) {
    const count = await this.repository.delete(id, userId);
    if (count === 0) {
      throw new NotFoundException('Item not found');
    }
  }

  async search(userId: string, query: string) {
    const items = await this.repository.searchByUser(userId, query);
    return items.map((item) => this.mapItem(item));
  }

  async getByList(listId: string, userId: string, cursor?: string, limit: number = 20) {
    const list = await this.listsRepository.findOneByUser(listId, userId);
    if (!list) {
      throw new NotFoundException('List not found');
    }

    const rows = await this.repository.findByList(listId, userId, cursor, limit);
    const hasNextPage = rows.length > limit;
    const items = hasNextPage ? rows.slice(0, limit) : rows;
    const nextCursor = hasNextPage ? items[items.length - 1].id : null;

    return {
      data: items.map((item) => this.mapItem(item)),
      nextCursor,
    };
  }
}
