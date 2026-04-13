import { Module } from '@nestjs/common';
import { ListsController } from './lists.controller';
import { ListsService } from './lists.service';
import { ListsRepository } from './lists.repository';

@Module({
  controllers: [ListsController],
  providers: [ListsService, ListsRepository],
  exports: [ListsRepository],
})
export class ListsModule {}
