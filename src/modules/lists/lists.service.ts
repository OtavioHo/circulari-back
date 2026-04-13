import { Injectable, NotFoundException } from '@nestjs/common';
import { ListsRepository } from './lists.repository';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';

@Injectable()
export class ListsService {
  constructor(private readonly repository: ListsRepository) {}

  async getAll(userId: string) {
    const lists = await this.repository.findAllByUser(userId);
    return lists.map((list) => ({
      id: list.id,
      name: list.name,
      item_count: list._count.items,
      total_value: list.total_value,
      created_at: list.created_at,
    }));
  }

  async create(userId: string, dto: CreateListDto) {
    const list = await this.repository.create(userId, dto.name);
    return {
      id: list.id,
      name: list.name,
      item_count: 0,
      total_value: 0,
      created_at: list.created_at,
    };
  }

  async rename(id: string, userId: string, dto: UpdateListDto) {
    const count = await this.repository.update(id, userId, dto.name);
    if (count === 0) {
      throw new NotFoundException('List not found');
    }
  }

  async remove(id: string, userId: string) {
    const count = await this.repository.delete(id, userId);
    if (count === 0) {
      throw new NotFoundException('List not found');
    }
  }
}
