import { Injectable, NotFoundException } from '@nestjs/common';
import { ListsRepository } from './lists.repository';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { LimitsService } from '../tiers/limits.service';

@Injectable()
export class ListsService {
  constructor(
    private readonly repository: ListsRepository,
    private readonly limits: LimitsService,
  ) {}

  getColors() {
    return this.repository.findAllColors();
  }

  getIcons() {
    return this.repository.findAllIcons();
  }

  async getAll(userId: string) {
    const lists = await this.repository.findAllByUser(userId);
    return lists.map((list) => ({
      id: list.id,
      name: list.name,
      location: list.location ?? null,
      color: list.color,
      icon: list.icon,
      item_count: list._count.items,
      total_value: list.total_value,
      created_at: list.created_at,
    }));
  }

  async create(userId: string, dto: CreateListDto) {
    const list = await this.limits.withListCapLock(userId, (tx) =>
      this.repository.create(userId, dto, tx),
    );
    return {
      id: list.id,
      name: list.name,
      location: list.location ?? null,
      color_id: list.color_id,
      icon_id: list.icon_id,
      item_count: 0,
      total_value: 0,
      created_at: list.created_at,
    };
  }

  async rename(id: string, userId: string, dto: UpdateListDto) {
    const list = await this.repository.update(id, userId, dto);
    if (!list) {
      throw new NotFoundException('List not found');
    }
    return {
      id: list.id,
      name: list.name,
      location: list.location ?? null,
      color_id: list.color_id,
      icon_id: list.icon_id,
      created_at: list.created_at,
    };
  }

  async remove(id: string, userId: string) {
    const count = await this.repository.delete(id, userId);
    if (count === 0) {
      throw new NotFoundException('List not found');
    }
  }
}
