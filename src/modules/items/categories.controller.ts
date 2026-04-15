import { Controller, Get } from '@nestjs/common';
import { ItemsService } from './items.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  findAll() {
    return this.itemsService.findAllCategories();
  }
}
