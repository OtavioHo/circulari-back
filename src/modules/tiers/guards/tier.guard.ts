import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { REQUIRES_TIER_KEY } from '../decorators/requires-tier.decorator';
import { Tier } from '../tier-limits.config';
import { LimitsRepository } from '../limits.repository';

/** Ordered ranking so a higher tier satisfies a lower requirement. */
const TIER_RANK: Record<Tier, number> = { free: 0, essencial: 1, pro: 2 };

function rankOf(tier: string): number {
  if (tier === 'premium') return TIER_RANK.pro; // legacy alias
  return TIER_RANK[tier as Tier] ?? TIER_RANK.free;
}

@Injectable()
export class TierGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limitsRepository: LimitsRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredTier = this.reflector.getAllAndOverride<Tier | undefined>(REQUIRES_TIER_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredTier) return true;

    const req = context.switchToHttp().getRequest<Request>();
    const user = req.user as { id: string } | undefined;
    if (!user) return true;

    const tier = await this.limitsRepository.getUserTier(user.id);
    if (rankOf(tier) < TIER_RANK[requiredTier]) {
      throw new ForbiddenException({
        code: 'TIER_REQUIRED',
        required_tier: requiredTier,
      });
    }
    return true;
  }
}
