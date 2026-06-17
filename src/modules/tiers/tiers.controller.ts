import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { LimitsService } from './limits.service';
import { RevenueCatService } from '../revenuecat/revenuecat.service';
import { UserThrottlerGuard } from '../../common/guards/user-throttler.guard';

@Controller('plan')
export class TiersController {
  constructor(
    private readonly limitsService: LimitsService,
    private readonly revenueCat: RevenueCatService,
  ) {}

  @Get()
  getPlanUsage(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.limitsService.getPlanUsage(user.id);
  }

  /**
   * Pull the user's subscription state from RevenueCat *now* and return fresh
   * plan usage. Called by the app right after a purchase/restore so the new tier
   * is reflected immediately instead of waiting for the async webhook.
   *
   * Per-user throttled because it makes an outbound RevenueCat REST call.
   */
  @Post('reconcile')
  @UseGuards(UserThrottlerGuard)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async reconcile(@Req() req: Request) {
    const user = req.user as { id: string };
    await this.revenueCat.reconcileUser(user.id);
    return this.limitsService.getPlanUsage(user.id);
  }
}
