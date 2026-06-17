import { Module } from '@nestjs/common';
import { RevenueCatController } from './revenuecat.controller';
import { RevenueCatService } from './revenuecat.service';
import { RevenueCatRepository } from './revenuecat.repository';
import { WebhookCleanupService } from './webhook-cleanup.service';

@Module({
  controllers: [RevenueCatController],
  providers: [RevenueCatService, RevenueCatRepository, WebhookCleanupService],
  exports: [RevenueCatService],
})
export class RevenueCatModule {}
