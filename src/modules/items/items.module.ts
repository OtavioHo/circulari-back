import { Module, forwardRef } from '@nestjs/common';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { ItemsRepository } from './items.repository';
import { ListsModule } from '../lists/lists.module';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [forwardRef(() => ListsModule), StorageModule],
  controllers: [ItemsController],
  providers: [ItemsService, ItemsRepository],
  exports: [ItemsService],
})
export class ItemsModule {}
