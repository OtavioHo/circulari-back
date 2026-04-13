import { Injectable, NotFoundException } from '@nestjs/common';
import { ItemsRepository } from './items.repository';
import { ListsRepository } from '../lists/lists.repository';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

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
    const item = await this.repository.create(dto);
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      user_defined_value: item.user_defined_value ? Number(item.user_defined_value) : null,
      images: [],
      created_at: item.created_at,
    };
  }

  async update(id: string, userId: string, dto: UpdateItemDto) {
    const count = await this.repository.update(id, userId, dto);
    if (count === 0) {
      throw new NotFoundException('Item not found');
    }
  }

  async remove(id: string, userId: string) {
    const count = await this.repository.delete(id, userId);
    if (count === 0) {
      throw new NotFoundException('Item not found');
    }
  }

  search(userId: string, query: string) {
    return this.repository.searchByUser(userId, query);
  }
}
