import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';

const mockCreate = jest.fn();

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
}));

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    mockCreate.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('test-api-key') },
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  const fakeBuffer = Buffer.from('fake-image-data');
  const fakeMime = 'image/jpeg';

  function makeOpenAIResponse(content: string) {
    return { choices: [{ message: { content } }] };
  }

  describe('analyze', () => {
    it('returns parsed result for a valid OpenAI response', async () => {
      const payload = { name: 'Cadeira', category: 'Móveis', price_min: 100, price_max: 500 };
      mockCreate.mockResolvedValue(makeOpenAIResponse(JSON.stringify(payload)));

      const result = await service.analyze(fakeBuffer, fakeMime);

      expect(result).toEqual(payload);
    });

    it('swaps price_min and price_max when price_min > price_max', async () => {
      const payload = { name: 'Mesa', category: 'Móveis', price_min: 500, price_max: 100 };
      mockCreate.mockResolvedValue(makeOpenAIResponse(JSON.stringify(payload)));

      const result = await service.analyze(fakeBuffer, fakeMime);

      expect(result.price_min).toBe(100);
      expect(result.price_max).toBe(500);
    });

    it('throws ServiceUnavailableException when OpenAI throws', async () => {
      mockCreate.mockRejectedValue(new Error('Network error'));

      await expect(service.analyze(fakeBuffer, fakeMime)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws ServiceUnavailableException when response is not valid JSON', async () => {
      mockCreate.mockResolvedValue(makeOpenAIResponse('not valid json at all'));

      await expect(service.analyze(fakeBuffer, fakeMime)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
