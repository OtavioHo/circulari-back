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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { GetItemsDto } from './dto/get-items.dto';
import { MAX_IMAGE_SIZE, multerImageFileFilter } from '../../common/utils/image-validation';

const imageInterceptor = FileInterceptor('image', {
  storage: memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE },
  fileFilter: multerImageFileFilter,
});

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  search(@Query() dto: GetItemsDto, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.itemsService.search(user.id, dto.search ?? '', dto.cursor, dto.limit);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(imageInterceptor)
  create(
    @Body() dto: CreateItemDto,
    @Req() req: Request,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    const user = req.user as { id: string };
    return this.itemsService.create(user.id, dto, image);
  }

  @Patch(':id')
  @UseInterceptors(imageInterceptor)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateItemDto,
    @Req() req: Request,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    const user = req.user as { id: string };
    return this.itemsService.update(id, user.id, dto, image);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as { id: string };
    await this.itemsService.remove(id, user.id);
  }
}
