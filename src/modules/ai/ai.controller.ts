import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Request } from 'express';
import { AiService } from './ai.service';
import {
  MAX_IMAGE_SIZE,
  multerImageFileFilter,
  validateImageMagicBytes,
} from '../../common/utils/image-validation';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_SIZE },
      fileFilter: multerImageFileFilter,
    }),
  )
  analyze(@UploadedFile() file: Express.Multer.File, @Req() req: Request) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }
    const actualMime = validateImageMagicBytes(file.buffer);
    const user = req.user as { id: string };
    return this.aiService.analyze(user.id, file.buffer, actualMime);
  }
}
