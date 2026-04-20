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

function parseNonNegativeInt(raw: unknown, fallback: number): number {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

@Injectable()
export class TierLimitsConfig {
  private readonly limits: Record<Tier, TierLimits>;

  constructor(config: ConfigService) {
    this.limits = {
      free: {
        maxLists: parseNonNegativeInt(config.get('FREE_MAX_LISTS'), DEFAULT_FREE_MAX_LISTS),
        maxItems: parseNonNegativeInt(config.get('FREE_MAX_ITEMS'), DEFAULT_FREE_MAX_ITEMS),
        maxAiCallsPerMonth: parseNonNegativeInt(
          config.get('FREE_MAX_AI_CALLS_PER_MONTH'),
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
