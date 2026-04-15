import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ItemsRepository } from './items.repository';
import { ListsRepository } from '../lists/lists.repository';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class ItemsService {
  constructor(
    private readonly repository: ItemsRepository,
    private readonly listsRepository: ListsRepository,
  ) {}

  async create(userId: string, dto: CreateItemDto) {
    const list = await this.listsRepository.findOneByUser(dto.list_id, userId);
    if (!list) {
      throw new NotFoundException('List not found');
    }
    let item: Awaited<ReturnType<typeof this.repository.create>>;
    try {
      item = await this.repository.create(dto);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new BadRequestException('Invalid category_id: category not found');
      }
      throw err;
    }
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      user_defined_value: item.user_defined_value != null ? Number(item.user_defined_value) : null,
      category: item.category ?? null,
      images: [],
      created_at: item.created_at,
    };
  }

  async update(id: string, userId: string, dto: UpdateItemDto) {
    let item: Awaited<ReturnType<typeof this.repository.update>>;
    try {
      item = await this.repository.update(id, userId, dto);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
        throw new BadRequestException('Invalid category_id: category not found');
      }
      throw err;
    }
    if (!item) {
      throw new NotFoundException('Item not found');
    }
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      user_defined_value: item.user_defined_value != null ? Number(item.user_defined_value) : null,
      category: item.category ?? null,
      images: [],
      created_at: item.created_at,
    };
  }

  async remove(id: string, userId: string) {
    const count = await this.repository.delete(id, userId);
    if (count === 0) {
      throw new NotFoundException('Item not found');
    }
  }

  async search(userId: string, query: string) {
    const items = await this.repository.searchByUser(userId, query);
    return items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      user_defined_value: item.user_defined_value != null ? Number(item.user_defined_value) : null,
      category: item.category ?? null,
      images: [],
      created_at: item.created_at,
    }));
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
      data: items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        user_defined_value:
          item.user_defined_value != null ? Number(item.user_defined_value) : null,
        category: item.category ?? null,
        images: [],
        created_at: item.created_at,
      })),
      nextCursor,
    };
  }
}
