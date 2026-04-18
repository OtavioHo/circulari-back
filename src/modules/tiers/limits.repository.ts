import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LimitsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getUserTier(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { tier: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user.tier;
  }

  countLists(userId: string) {
    return this.prisma.list.count({ where: { user_id: userId } });
  }

  countItems(userId: string) {
    return this.prisma.item.count({ where: { list: { user_id: userId } } });
  }

  async getMonthlyAiCalls(userId: string, month: string): Promise<number> {
    const row = await this.prisma.aiUsage.findUnique({
      where: { user_id_month: { user_id: userId, month } },
      select: { call_count: true },
    });
    return row?.call_count ?? 0;
  }

  async incrementMonthlyAiCalls(userId: string, month: string): Promise<void> {
    await this.prisma.aiUsage.upsert({
      where: { user_id_month: { user_id: userId, month } },
      create: { user_id: userId, month, call_count: 1 },
      update: { call_count: { increment: 1 } },
    });
  }
}
