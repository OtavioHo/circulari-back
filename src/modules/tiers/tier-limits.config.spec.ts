import { ConfigService } from '@nestjs/config';
import { TierLimitsConfig } from './tier-limits.config';

describe('TierLimitsConfig', () => {
  const make = (env: Record<string, string> = {}) =>
    new TierLimitsConfig({ get: (k: string) => env[k] } as unknown as ConfigService);

  it('applies the default caps for each tier', () => {
    const cfg = make();

    expect(cfg.get('free')).toEqual({ maxLists: 1, maxItems: 50, maxAiCallsPerMonth: 10 });
    expect(cfg.get('essencial')).toEqual({
      maxLists: 3,
      maxItems: 70,
      maxAiCallsPerMonth: Infinity,
    });
    expect(cfg.get('pro')).toEqual({ maxLists: 5, maxItems: 150, maxAiCallsPerMonth: Infinity });
  });

  it('keeps AI unlimited on paid tiers', () => {
    const cfg = make();
    expect(cfg.get('essencial').maxAiCallsPerMonth).toBe(Infinity);
    expect(cfg.get('pro').maxAiCallsPerMonth).toBe(Infinity);
  });

  it('aliases legacy "premium" to pro and unknown tiers to free', () => {
    const cfg = make();
    expect(cfg.get('premium')).toEqual(cfg.get('pro'));
    expect(cfg.get('something-else')).toEqual(cfg.get('free'));
  });

  it('honors env overrides for list/item caps', () => {
    const cfg = make({
      FREE_MAX_LISTS: '2',
      FREE_MAX_ITEMS: '20',
      FREE_MAX_AI_CALLS_PER_MONTH: '3',
      ESSENCIAL_MAX_LISTS: '4',
      ESSENCIAL_MAX_ITEMS: '80',
      PRO_MAX_LISTS: '9',
      PRO_MAX_ITEMS: '900',
    });

    expect(cfg.get('free')).toEqual({ maxLists: 2, maxItems: 20, maxAiCallsPerMonth: 3 });
    expect(cfg.get('essencial')).toMatchObject({ maxLists: 4, maxItems: 80 });
    expect(cfg.get('pro')).toMatchObject({ maxLists: 9, maxItems: 900 });
  });

  it('ignores invalid env values and falls back to defaults', () => {
    const cfg = make({ FREE_MAX_LISTS: 'abc', PRO_MAX_ITEMS: '-5' });
    expect(cfg.get('free').maxLists).toBe(1);
    expect(cfg.get('pro').maxItems).toBe(150);
  });
});
