import { Module } from '@nestjs/common';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { ItemsRepository } from './items.repository';
import { ListsRepository } from '../lists/lists.repository';

@Module({
  controllers: [ItemsController],
  providers: [ItemsService, ItemsRepository, ListsRepository],
})
export class ItemsModule {}
