import { ForbiddenException, Injectable } from '@nestjs/common';
import { LimitsRepository } from './limits.repository';
import { TierLimitsConfig } from './tier-limits.config';

function currentMonth(date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function limitReached(limit: number): ForbiddenException {
  return new ForbiddenException({ code: 'LIMIT_REACHED', limit });
}

@Injectable()
export class LimitsService {
  constructor(
    private readonly repository: LimitsRepository,
    private readonly config: TierLimitsConfig,
  ) {}

  async assertCanCreateList(userId: string): Promise<void> {
    const { maxLists } = this.config.get(await this.repository.getUserTier(userId));
    if (!isFinite(maxLists)) return;
    const count = await this.repository.countLists(userId);
    if (count >= maxLists) throw limitReached(maxLists);
  }

  async assertCanCreateItem(userId: string): Promise<void> {
    const { maxItems } = this.config.get(await this.repository.getUserTier(userId));
    if (!isFinite(maxItems)) return;
    const count = await this.repository.countItems(userId);
    if (count >= maxItems) throw limitReached(maxItems);
  }

  async assertCanUseAi(userId: string): Promise<void> {
    const { maxAiCallsPerMonth } = this.config.get(await this.repository.getUserTier(userId));
    if (!isFinite(maxAiCallsPerMonth)) return;
    const count = await this.repository.getMonthlyAiCalls(userId, currentMonth());
    if (count >= maxAiCallsPerMonth) throw limitReached(maxAiCallsPerMonth);
  }

  recordAiCall(userId: string): Promise<void> {
    return this.repository.incrementMonthlyAiCalls(userId, currentMonth());
  }
}
