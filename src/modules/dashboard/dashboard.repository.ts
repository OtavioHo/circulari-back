import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(userId: string) {
    const [listCount, itemAgg] = await Promise.all([
      this.prisma.list.count({ where: { user_id: userId } }),
      this.prisma.item.aggregate({
        where: { list: { user_id: userId } },
        _count: { id: true },
        _sum: { user_defined_value: true },
      }),
    ]);
    return {
      list_count: listCount,
      item_count: itemAgg._count.id,
      total_value: Number(itemAgg._sum.user_defined_value ?? 0),
    };
  }
}
