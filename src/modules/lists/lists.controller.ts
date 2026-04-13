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
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ListsService } from './lists.service';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';

@Controller('lists')
export class ListsController {
  constructor(private readonly listsService: ListsService) {}

  @Get()
  getAll(@Req() req: Request) {
    const user = req.user as { id: string };
    return this.listsService.getAll(user.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Req() req: Request, @Body() dto: CreateListDto) {
    const user = req.user as { id: string };
    return this.listsService.create(user.id, dto);
  }

  @Patch(':id')
  async rename(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateListDto) {
    const user = req.user as { id: string };
    await this.listsService.rename(id, user.id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: Request, @Param('id') id: string) {
    const user = req.user as { id: string };
    await this.listsService.remove(id, user.id);
  }
}
