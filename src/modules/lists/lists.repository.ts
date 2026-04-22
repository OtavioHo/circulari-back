import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class ListsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllColors() {
    return this.prisma.listColor.findMany({ orderBy: { order: 'asc' } });
  }

  findAllIcons() {
    return this.prisma.listIcon.findMany({ orderBy: { order: 'asc' } });
  }

  async findAllByUser(userId: string) {
    const lists = await this.prisma.list.findMany({
      where: { user_id: userId },
      include: { _count: { select: { items: true } }, color: true, icon: true },
      orderBy: { created_at: 'desc' },
    });

    if (lists.length === 0) return [];

    const totals = await this.prisma.item.groupBy({
      by: ['list_id'],
      where: { list_id: { in: lists.map((l) => l.id) } },
      _sum: { user_defined_value: true },
    });

    const totalByListId = new Map(
      totals.map((t) => [t.list_id, Number(t._sum.user_defined_value ?? 0)]),
    );

    return lists.map((list) => ({
      ...list,
      total_value: totalByListId.get(list.id) ?? 0,
    }));
  }

  create(userId: string, dto: CreateListDto, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    return client.list.create({
      data: {
        user_id: userId,
        name: dto.name,
        location: dto.location,
        color_id: dto.color_id,
        icon_id: dto.icon_id,
      },
    });
  }

  findOneByUser(id: string, userId: string) {
    return this.prisma.list.findFirst({ where: { id, user_id: userId } });
  }

  async update(id: string, userId: string, dto: UpdateListDto) {
    const result = await this.prisma.list.updateMany({
      where: { id, user_id: userId },
      data: {
        name: dto.name,
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.color_id !== undefined && { color_id: dto.color_id }),
        ...(dto.icon_id !== undefined && { icon_id: dto.icon_id }),
      },
    });
    if (result.count === 0) return null;
    return this.prisma.list.findUnique({ where: { id } });
  }

  async delete(id: string, userId: string) {
    const result = await this.prisma.list.deleteMany({
      where: { id, user_id: userId },
    });
    return result.count;
  }
}
