import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ListsModule } from './modules/lists/lists.module';
import { ItemsModule } from './modules/items/items.module';
import { StorageModule } from './modules/storage/storage.module';
import { AiModule } from './modules/ai/ai.module';
import { TiersModule } from './modules/tiers/tiers.module';
import { RevenueCatModule } from './modules/revenuecat/revenuecat.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { EmailModule } from './modules/email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Rate-limit definitions are opt-in per route via @UseGuards(ThrottlerGuard)
    // + @Throttle — registering the module here does not throttle anything global.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 30 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    HealthModule,
    AuthModule,
    TiersModule,
    ListsModule,
    ItemsModule,
    StorageModule,
    AiModule,
    RevenueCatModule,
    DashboardModule,
    EmailModule,
  ],
})
export class AppModule {}
