import { Module, forwardRef } from '@nestjs/common';
import { ListsController } from './lists.controller';
import { ListsService } from './lists.service';
import { ListsRepository } from './lists.repository';
import { ItemsModule } from '../items/items.module';

@Module({
  imports: [forwardRef(() => ItemsModule)],
  controllers: [ListsController],
  providers: [ListsService, ListsRepository],
  exports: [ListsRepository],
})
export class ListsModule {}
