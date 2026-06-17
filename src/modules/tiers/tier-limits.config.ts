import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type Tier = 'free' | 'essencial' | 'pro';

export interface TierLimits {
  maxLists: number;
  maxItems: number;
  maxAiCallsPerMonth: number;
}

const DEFAULTS: Record<Tier, TierLimits> = {
  free: { maxLists: 1, maxItems: 50, maxAiCallsPerMonth: 10 },
  essencial: { maxLists: 3, maxItems: 70, maxAiCallsPerMonth: Infinity },
  pro: { maxLists: 5, maxItems: 150, maxAiCallsPerMonth: Infinity },
};

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
        maxLists: parseNonNegativeInt(config.get('FREE_MAX_LISTS'), DEFAULTS.free.maxLists),
        maxItems: parseNonNegativeInt(config.get('FREE_MAX_ITEMS'), DEFAULTS.free.maxItems),
        maxAiCallsPerMonth: parseNonNegativeInt(
          config.get('FREE_MAX_AI_CALLS_PER_MONTH'),
          DEFAULTS.free.maxAiCallsPerMonth,
        ),
      },
      essencial: {
        maxLists: parseNonNegativeInt(
          config.get('ESSENCIAL_MAX_LISTS'),
          DEFAULTS.essencial.maxLists,
        ),
        maxItems: parseNonNegativeInt(
          config.get('ESSENCIAL_MAX_ITEMS'),
          DEFAULTS.essencial.maxItems,
        ),
        // AI is unlimited on paid tiers; no env override exposed.
        maxAiCallsPerMonth: DEFAULTS.essencial.maxAiCallsPerMonth,
      },
      pro: {
        maxLists: parseNonNegativeInt(config.get('PRO_MAX_LISTS'), DEFAULTS.pro.maxLists),
        maxItems: parseNonNegativeInt(config.get('PRO_MAX_ITEMS'), DEFAULTS.pro.maxItems),
        maxAiCallsPerMonth: DEFAULTS.pro.maxAiCallsPerMonth,
      },
    };
  }

  /**
   * Resolves limits for a tier string. Unknown tiers fall back to `free`.
   * Legacy `premium` is aliased to `pro` (closest to the old unlimited tier).
   */
  get(tier: string): TierLimits {
    if (tier === 'pro' || tier === 'premium') return this.limits.pro;
    if (tier === 'essencial') return this.limits.essencial;
    return this.limits.free;
  }
}
