import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { LimitsRepository } from './limits.repository';
import { LimitsService } from './limits.service';
import { TierGuard } from './guards/tier.guard';
import { TierLimitsConfig } from './tier-limits.config';
import { TiersController } from './tiers.controller';
import { RevenueCatModule } from '../revenuecat/revenuecat.module';

@Global()
@Module({
  imports: [RevenueCatModule],
  controllers: [TiersController],
  providers: [
    TierLimitsConfig,
    LimitsRepository,
    LimitsService,
    { provide: APP_GUARD, useClass: TierGuard },
  ],
  exports: [LimitsRepository, LimitsService, TierLimitsConfig],
})
export class TiersModule {}
