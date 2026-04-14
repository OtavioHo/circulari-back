import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

describe('AiController', () => {
  let controller: AiController;

  const mockAiService = {
    analyze: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [{ provide: AiService, useValue: mockAiService }],
    }).compile();

    controller = module.get<AiController>(AiController);
    jest.clearAllMocks();
  });

  // JPEG magic bytes (FF D8 FF E0) so detectMimeFromMagicBytes passes
  const fakeFile = {
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
    mimetype: 'image/jpeg',
    originalname: 'photo.jpg',
    size: 1024,
  } as Express.Multer.File;

  describe('analyze', () => {
    it('delegates to aiService.analyze with buffer and mimetype', async () => {
      const expected = { name: 'Cadeira', category: 'Móveis', price_min: 100, price_max: 500 };
      mockAiService.analyze.mockResolvedValue(expected);

      const result = await controller.analyze(fakeFile);

      expect(mockAiService.analyze).toHaveBeenCalledWith(fakeFile.buffer, 'image/jpeg');
      expect(result).toBe(expected);
    });

    it('throws BadRequestException when no file is uploaded', () => {
      expect(() => controller.analyze(undefined as any)).toThrow(BadRequestException);
      expect(mockAiService.analyze).not.toHaveBeenCalled();
    });

    it('is NOT marked @Public so JwtAuthGuard protects it', () => {
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, AiController.prototype.analyze);
      expect(isPublic).toBeUndefined();
    });
  });
});
