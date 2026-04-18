import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { LimitsRepository } from './limits.repository';
import { LimitsService } from './limits.service';
import { TierGuard } from './guards/tier.guard';
import { TierLimitsConfig } from './tier-limits.config';

@Global()
@Module({
  providers: [
    TierLimitsConfig,
    LimitsRepository,
    LimitsService,
    TierGuard,
    { provide: APP_GUARD, useClass: TierGuard },
  ],
  exports: [LimitsRepository, LimitsService, TierLimitsConfig],
})
export class TiersModule {}
