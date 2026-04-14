import { Module, forwardRef } from '@nestjs/common';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { ItemsRepository } from './items.repository';
import { ListsModule } from '../lists/lists.module';

@Module({
  imports: [forwardRef(() => ListsModule)],
  controllers: [ItemsController],
  providers: [ItemsService, ItemsRepository],
  exports: [ItemsService],
})
export class ItemsModule {}
