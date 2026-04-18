import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';

@Injectable()
export class RevenueCatRepository {
  constructor(private readonly prisma: PrismaService) {}

  async updateUserTier(userId: string, tier: 'free' | 'premium'): Promise<boolean> {
    const result = await this.prisma.user.updateMany({
      where: { id: userId },
      data: { tier },
    });
    return result.count > 0;
  }

  /**
   * Atomically records the event and updates the user tier in a single transaction.
   * Returns true if processed, false if the event was already handled.
   */
  async processEvent(
    eventId: string,
    userId: string,
    tier: 'free' | 'premium' | null,
  ): Promise<{ duplicate: boolean; userUpdated: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      try {
        await tx.processedWebhookEvent.create({
          data: { event_id: eventId, provider: 'revenuecat' },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          return { duplicate: true, userUpdated: false };
        }
        throw err;
      }

      if (tier === null) {
        return { duplicate: false, userUpdated: false };
      }

      const updated = await tx.user.updateMany({ where: { id: userId }, data: { tier } });
      return { duplicate: false, userUpdated: updated.count > 0 };
    });
  }
}
