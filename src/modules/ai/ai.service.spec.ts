import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { PrismaService } from '../prisma/prisma.service';

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

const mockCategories = [
  { id: 'uuid-1', name: 'Eletrônicos' },
  { id: 'uuid-2', name: 'Móveis' },
];

describe('AiService', () => {
  let service: AiService;
  let prisma: { category: { findMany: jest.Mock } };

  beforeEach(async () => {
    mockCreate.mockReset();

    prisma = { category: { findMany: jest.fn().mockResolvedValue(mockCategories) } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('test-api-key') },
        },
        {
          provide: PrismaService,
          useValue: prisma,
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
    it('returns parsed result for a valid OpenAI response with matching category', async () => {
      const payload = {
        name: 'Notebook',
        category: 'Eletrônicos',
        description: 'Um notebook moderno.',
        price_min: 2000,
        price_max: 5000,
      };
      mockCreate.mockResolvedValue(makeOpenAIResponse(JSON.stringify(payload)));

      const result = await service.analyze(fakeBuffer, fakeMime);

      expect(result.name).toBe('Notebook');
      expect(result.category).toBe('Eletrônicos');
      expect(result.category_id).toBe('uuid-1');
      expect(result.description).toBe('Um notebook moderno.');
      expect(result.price_min).toBe(2000);
      expect(result.price_max).toBe(5000);
    });

    it('resolves category_id case-insensitively', async () => {
      const payload = {
        name: 'Cadeira',
        category: 'móveis',
        description: 'Uma cadeira confortável.',
        price_min: 300,
        price_max: 800,
      };
      mockCreate.mockResolvedValue(makeOpenAIResponse(JSON.stringify(payload)));

      const result = await service.analyze(fakeBuffer, fakeMime);

      expect(result.category).toBe('Móveis');
      expect(result.category_id).toBe('uuid-2');
    });

    it('sets category_id to null when AI returns null for category', async () => {
      const payload = {
        name: 'Objeto Estranho',
        category: null,
        description: 'Um objeto de origem desconhecida.',
        price_min: 10,
        price_max: 50,
      };
      mockCreate.mockResolvedValue(makeOpenAIResponse(JSON.stringify(payload)));

      const result = await service.analyze(fakeBuffer, fakeMime);

      expect(result.category).toBeNull();
      expect(result.category_id).toBeNull();
    });

    it('sets category and category_id to null when AI returns an unrecognized category name', async () => {
      const payload = {
        name: 'Item X',
        category: 'CategoriaDesconhecida',
        description: 'Descrição do item X.',
        price_min: 100,
        price_max: 200,
      };
      mockCreate.mockResolvedValue(makeOpenAIResponse(JSON.stringify(payload)));

      const result = await service.analyze(fakeBuffer, fakeMime);

      expect(result.category).toBeNull();
      expect(result.category_id).toBeNull();
    });

    it('swaps price_min and price_max when price_min > price_max', async () => {
      const payload = {
        name: 'Mesa',
        category: 'Móveis',
        description: 'Uma mesa de madeira.',
        price_min: 500,
        price_max: 100,
      };
      mockCreate.mockResolvedValue(makeOpenAIResponse(JSON.stringify(payload)));

      const result = await service.analyze(fakeBuffer, fakeMime);

      expect(result.price_min).toBe(100);
      expect(result.price_max).toBe(500);
    });

    it('includes all category names in the built prompt', async () => {
      const payload = {
        name: 'TV',
        category: 'Eletrônicos',
        description: 'Uma televisão.',
        price_min: 1000,
        price_max: 3000,
      };
      mockCreate.mockResolvedValue(makeOpenAIResponse(JSON.stringify(payload)));

      await service.analyze(fakeBuffer, fakeMime);

      const promptText = mockCreate.mock.calls[0][0].messages[0].content[0].text as string;
      expect(promptText).toContain('Eletrônicos');
      expect(promptText).toContain('Móveis');
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
