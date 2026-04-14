import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AiService } from './ai.service';

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function detectMimeFromMagicBytes(buf: Buffer): string | null {
  if (buf.length < 4) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif';
  if (
    buf.length >= 12 &&
    buf[0] === 0x52 &&
    buf[1] === 0x49 &&
    buf[2] === 0x46 &&
    buf[3] === 0x46 &&
    buf[8] === 0x57 &&
    buf[9] === 0x45 &&
    buf[10] === 0x42 &&
    buf[11] === 0x50
  )
    return 'image/webp';
  return null;
}

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('analyze')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_SIZE },
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Only image files are allowed'), false);
        }
      },
    }),
  )
  analyze(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }
    const actualMime = detectMimeFromMagicBytes(file.buffer);
    if (!actualMime || !ALLOWED_MIMETYPES.includes(actualMime)) {
      throw new BadRequestException('Only image files are allowed');
    }
    return this.aiService.analyze(file.buffer, actualMime);
  }
}
