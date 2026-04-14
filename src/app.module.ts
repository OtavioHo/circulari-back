import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './modules/health/health.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { ListsModule } from './modules/lists/lists.module';
import { ItemsModule } from './modules/items/items.module';
import { LocationsModule } from './modules/locations/locations.module';
import { StorageModule } from './modules/storage/storage.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    ListsModule,
    ItemsModule,
    LocationsModule,
    StorageModule,
  ],
})
export class AppModule {}
