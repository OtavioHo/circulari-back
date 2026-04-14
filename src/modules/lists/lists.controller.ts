import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ListsService } from './lists.service';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { ItemsService } from '../items/items.service';
import { GetItemsByListDto } from '../items/dto/get-items-by-list.dto';

@Controller('lists')
export class ListsController {
  constructor(
    private readonly listsService: ListsService,
    private readonly itemsService: ItemsService,
  ) {}

  @Get()
  getAll(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.listsService.getAll(user.id);
  }

  @Get(':id/items')
  getItems(@Param('id') id: string, @Query() query: GetItemsByListDto, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.itemsService.getByList(id, user.id, query.cursor, query.limit);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Req() req: Request, @Body() dto: CreateListDto) {
    const user = req.user as { id: string };
    return this.listsService.create(user.id, dto);
  }

  @Patch(':id')
  rename(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateListDto) {
    const user = req.user as { id: string };
    return this.listsService.rename(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id: string };
    await this.listsService.remove(id, user.id);
  }
}
