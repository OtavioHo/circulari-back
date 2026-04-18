import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type Tier = 'free' | 'premium';

export interface TierLimits {
  maxLists: number;
  maxItems: number;
  maxAiCallsPerMonth: number;
}

const DEFAULT_FREE_MAX_LISTS = 3;
const DEFAULT_FREE_MAX_ITEMS = 50;
const DEFAULT_FREE_MAX_AI_CALLS_PER_MONTH = 10;

@Injectable()
export class TierLimitsConfig {
  private readonly limits: Record<Tier, TierLimits>;

  constructor(config: ConfigService) {
    this.limits = {
      free: {
        maxLists: config.get<number>('FREE_MAX_LISTS', DEFAULT_FREE_MAX_LISTS),
        maxItems: config.get<number>('FREE_MAX_ITEMS', DEFAULT_FREE_MAX_ITEMS),
        maxAiCallsPerMonth: config.get<number>(
          'FREE_MAX_AI_CALLS_PER_MONTH',
          DEFAULT_FREE_MAX_AI_CALLS_PER_MONTH,
        ),
      },
      premium: {
        maxLists: Infinity,
        maxItems: Infinity,
        maxAiCallsPerMonth: Infinity,
      },
    };
  }

  get(tier: string): TierLimits {
    return tier === 'premium' ? this.limits.premium : this.limits.free;
  }
}
