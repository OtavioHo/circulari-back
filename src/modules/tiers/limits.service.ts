import { ForbiddenException, Injectable } from '@nestjs/common';
import { LimitsRepository } from './limits.repository';
import { TierLimitsConfig } from './tier-limits.config';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';

function currentMonth(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function limitReached(limit: number): ForbiddenException {
  return new ForbiddenException({ code: 'LIMIT_REACHED', limit });
}

function lockKey(scope: 'list' | 'item', userId: string): string {
  return `${scope}-cap:${userId}`;
}

@Injectable()
export class LimitsService {
  constructor(
    private readonly repository: LimitsRepository,
    private readonly config: TierLimitsConfig,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Runs `fn` inside a per-user transaction that holds an advisory lock while
   * verifying the list cap. Concurrent creates for the same user serialize on
   * the lock, so the cap cannot be bypassed by racing requests.
   */
  async withListCapLock<T>(
    userId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey('list', userId)}))`;
      const { maxLists } = this.config.get(await this.tierInTx(tx, userId));
      if (isFinite(maxLists)) {
        const count = await tx.list.count({ where: { user_id: userId } });
        if (count >= maxLists) throw limitReached(maxLists);
      }
      return fn(tx);
    });
  }

  async withItemCapLock<T>(
    userId: string,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey('item', userId)}))`;
      const { maxItems } = this.config.get(await this.tierInTx(tx, userId));
      if (isFinite(maxItems)) {
        const count = await tx.item.count({ where: { list: { user_id: userId } } });
        if (count >= maxItems) throw limitReached(maxItems);
      }
      return fn(tx);
    });
  }

  /**
   * Returns true when a counter row was incremented (caller must pair with
   * {@link releaseAiReservation} on failure). Returns false when the tier has
   * no cap (premium) so no release is needed.
   */
  async reserveAiCall(userId: string): Promise<boolean> {
    const { maxAiCallsPerMonth } = this.config.get(await this.repository.getUserTier(userId));
    if (!isFinite(maxAiCallsPerMonth)) return false;
    if (maxAiCallsPerMonth <= 0) throw limitReached(maxAiCallsPerMonth);

    const reserved = await this.repository.reserveAiCall(
      userId,
      currentMonth(),
      maxAiCallsPerMonth,
    );
    if (!reserved) throw limitReached(maxAiCallsPerMonth);
    return true;
  }

  async releaseAiReservation(userId: string): Promise<void> {
    await this.repository.releaseAiReservation(userId, currentMonth());
  }

  private async tierInTx(tx: Prisma.TransactionClient, userId: string): Promise<string> {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { tier: true } });
    return user?.tier ?? 'free';
  }
}
