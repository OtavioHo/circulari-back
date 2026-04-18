import { SetMetadata } from '@nestjs/common';
import { Tier } from '../tier-limits.config';

export const REQUIRES_TIER_KEY = 'requiresTier';
export const RequiresTier = (tier: Tier) => SetMetadata(REQUIRES_TIER_KEY, tier);
