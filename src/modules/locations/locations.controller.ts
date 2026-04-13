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
import { LocationsService } from './locations.service';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';

@Controller('location')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  search(@Query('search') query: string | undefined, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.locationsService.search(user.id, query);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateLocationDto, @Req() req: Request) {
    const user = req.user as { id: string };
    return this.locationsService.create(user.id, dto.name);
  }

  @Patch(':id')
  async rename(@Param('id') id: string, @Body() dto: UpdateLocationDto, @Req() req: Request) {
    const user = req.user as { id: string };
    await this.locationsService.update(id, user.id, dto.name);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @Req() req: Request) {
    const user = req.user as { id: string };
    await this.locationsService.remove(id, user.id);
  }
}
