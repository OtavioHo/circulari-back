import { Module } from '@nestjs/common';
import { RevenueCatController } from './revenuecat.controller';
import { RevenueCatService } from './revenuecat.service';
import { RevenueCatRepository } from './revenuecat.repository';

@Module({
  controllers: [RevenueCatController],
  providers: [RevenueCatService, RevenueCatRepository],
  exports: [RevenueCatService],
})
export class RevenueCatModule {}
