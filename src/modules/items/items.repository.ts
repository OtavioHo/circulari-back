import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

type ImagePayload = { url: string; storageKey: string; isMain: boolean };

const includeImages = { category: true, images: true } as const;

@Injectable()
export class ItemsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateItemDto) {
    return this.prisma.item.create({
      data: {
        list_id: dto.list_id,
        name: dto.name,
        description: dto.description,
        quantity: dto.quantity ?? 1,
        category_id: dto.category_id,
        user_defined_value: dto.user_defined_value,
      },
      include: includeImages,
    });
  }

  createWithImage(dto: CreateItemDto, itemId: string, image: ImagePayload) {
    return this.prisma.$transaction(async (tx) => {
      const item = await tx.item.create({
        data: {
          id: itemId,
          list_id: dto.list_id,
          name: dto.name,
          description: dto.description,
          quantity: dto.quantity ?? 1,
          category_id: dto.category_id,
          user_defined_value: dto.user_defined_value,
        },
      });
      await tx.itemImage.create({
        data: {
          item_id: item.id,
          url: image.url,
          storage_key: image.storageKey,
          is_main: image.isMain,
        },
      });
      return tx.item.findUniqueOrThrow({ where: { id: item.id }, include: includeImages });
    });
  }

  findOneOwnedByUser(id: string, userId: string) {
    return this.prisma.item.findFirst({
      where: { id, list: { user_id: userId } },
      include: includeImages,
    });
  }

  async update(id: string, userId: string, dto: UpdateItemDto, image?: ImagePayload) {
    return this.prisma.$transaction(async (tx) => {
      const result = await tx.item.updateMany({
        where: { id, list: { user_id: userId } },
        data: {
          ...(dto.name != null && { name: dto.name }),
          ...(dto.description != null && { description: dto.description }),
          ...(dto.quantity != null && { quantity: dto.quantity }),
          ...(dto.category_id !== undefined && { category_id: dto.category_id }),
          ...(dto.user_defined_value != null && {
            user_defined_value: dto.user_defined_value,
          }),
        },
      });
      if (result.count === 0) return null;

      if (image) {
        await tx.itemImage.deleteMany({ where: { item_id: id, is_main: true } });
        await tx.itemImage.create({
          data: {
            item_id: id,
            url: image.url,
            storage_key: image.storageKey,
            is_main: image.isMain,
          },
        });
      }

      return tx.item.findFirst({ where: { id }, include: includeImages });
    });
  }

  async delete(id: string, userId: string) {
    const result = await this.prisma.item.deleteMany({
      where: { id, list: { user_id: userId } },
    });
    return result.count;
  }

  searchByUser(userId: string, search: string) {
    return this.prisma.item.findMany({
      where: {
        list: { user_id: userId },
        name: { contains: search, mode: 'insensitive' },
      },
      orderBy: { created_at: 'desc' },
      include: includeImages,
    });
  }

  findByList(listId: string, userId: string, cursor?: string, limit: number = 20) {
    return this.prisma.item.findMany({
      where: { list_id: listId, list: { user_id: userId } },
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor && { cursor: { id: cursor }, skip: 1 }),
      include: includeImages,
    });
  }
}
