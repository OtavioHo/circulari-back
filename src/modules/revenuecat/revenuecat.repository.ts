import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { Tier } from '../tiers/tier-limits.config';

@Injectable()
export class RevenueCatRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reconciliation snapshot is the current truth, so it always wins over the
   * ordering guard and refreshes `tier_event_at` to now.
   */
  async updateUserTier(userId: string, tier: Tier): Promise<boolean> {
    const result = await this.prisma.user.updateMany({
      where: { id: userId },
      data: { tier, tier_event_at: new Date() },
    });
    return result.count > 0;
  }

  /**
   * Atomically records the event and updates the user tier in a single transaction.
   *
   * Returns `{ duplicate, stale, userUpdated }`:
   * - `duplicate`  — the event id was already processed (idempotent replay).
   * - `stale`      — the event is older than the last applied tier change, so it
   *                  was recorded but the tier was left untouched (out-of-order guard).
   * - `userUpdated`— a tier change was actually persisted.
   */
  async processEvent(
    eventId: string,
    userId: string,
    tier: Tier | null,
    eventAt: Date,
  ): Promise<{ duplicate: boolean; stale: boolean; userUpdated: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      try {
        await tx.processedWebhookEvent.create({
          data: { event_id: eventId, provider: 'revenuecat' },
        });
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
          return { duplicate: true, stale: false, userUpdated: false };
        }
        throw err;
      }

      if (tier === null) {
        return { duplicate: false, stale: false, userUpdated: false };
      }

      // Apply only when this event is at least as recent as the last applied
      // change. Concurrent/retried out-of-order deliveries cannot regress tier.
      const updated = await tx.user.updateMany({
        where: {
          id: userId,
          OR: [{ tier_event_at: null }, { tier_event_at: { lte: eventAt } }],
        },
        data: { tier, tier_event_at: eventAt },
      });

      if (updated.count > 0) {
        return { duplicate: false, stale: false, userUpdated: true };
      }

      // No row updated: either the user is unknown, or a newer change already
      // landed. Distinguish so the caller can log appropriately.
      const exists = await tx.user.count({ where: { id: userId } });
      return { duplicate: false, stale: exists > 0, userUpdated: false };
    });
  }

  /** Prunes processed-event dedup rows older than `cutoff`. Returns rows deleted. */
  async deleteProcessedEventsOlderThan(cutoff: Date): Promise<number> {
    const result = await this.prisma.processedWebhookEvent.deleteMany({
      where: { provider: 'revenuecat', processed_at: { lt: cutoff } },
    });
    return result.count;
  }
}
