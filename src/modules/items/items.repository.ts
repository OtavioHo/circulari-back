import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

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
        location_id: dto.location_id,
        user_defined_value: dto.user_defined_value,
      },
    });
  }

  findOneOwnedByUser(id: string, userId: string) {
    return this.prisma.item.findFirst({
      where: { id, list: { user_id: userId } },
    });
  }

  async update(id: string, userId: string, dto: UpdateItemDto) {
    const result = await this.prisma.item.updateMany({
      where: { id, list: { user_id: userId } },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.quantity !== undefined && { quantity: dto.quantity }),
        ...(dto.location_id !== undefined && { location_id: dto.location_id }),
        ...(dto.user_defined_value !== undefined && {
          user_defined_value: dto.user_defined_value,
        }),
      },
    });
    return result.count;
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
    });
  }
}
