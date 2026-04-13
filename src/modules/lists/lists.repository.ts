import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ListsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByUser(userId: string) {
    const lists = await this.prisma.list.findMany({
      where: { user_id: userId },
      include: { _count: { select: { items: true } } },
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

  create(userId: string, name: string) {
    return this.prisma.list.create({
      data: { user_id: userId, name },
    });
  }

  findOneByUser(id: string, userId: string) {
    return this.prisma.list.findFirst({ where: { id, user_id: userId } });
  }

  async update(id: string, userId: string, name: string) {
    const result = await this.prisma.list.updateMany({
      where: { id, user_id: userId },
      data: { name },
    });
    return result.count;
  }

  async delete(id: string, userId: string) {
    const result = await this.prisma.list.deleteMany({
      where: { id, user_id: userId },
    });
    return result.count;
  }
}
