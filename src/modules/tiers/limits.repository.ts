import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
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

  async reserveAiCall(userId: string, month: string, max: number): Promise<boolean> {
    const id = randomUUID();
    const affected = await this.prisma.$executeRaw`
      INSERT INTO "ai_usages" ("id", "user_id", "month", "call_count")
      VALUES (${id}, ${userId}, ${month}, 1)
      ON CONFLICT ("user_id", "month") DO UPDATE
      SET "call_count" = "ai_usages"."call_count" + 1
      WHERE "ai_usages"."call_count" < ${max}
    `;
    return affected > 0;
  }

  async releaseAiReservation(userId: string, month: string): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "ai_usages"
      SET "call_count" = GREATEST("call_count" - 1, 0)
      WHERE "user_id" = ${userId} AND "month" = ${month}
    `;
  }
}
