import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';
import { PrismaService } from '../prisma/prisma.service';
import { LimitsService } from '../tiers/limits.service';

// Primary provider: Gemini (grounded). `models.generateContent` is mocked.
const mockGenerate = jest.fn();
jest.mock('@google/genai', () => ({
  __esModule: true,
  GoogleGenAI: jest.fn().mockImplementation(() => ({
    models: { generateContent: mockGenerate },
  })),
}));

// Fallback provider: OpenAI (ungrounded). `chat.completions.create` is mocked.
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
  let limits: { reserveAiCall: jest.Mock; releaseAiReservation: jest.Mock };

  beforeEach(async () => {
    mockGenerate.mockReset();
    mockCreate.mockReset();

    prisma = { category: { findMany: jest.fn().mockResolvedValue(mockCategories) } };
    limits = {
      reserveAiCall: jest.fn().mockResolvedValue(true),
      releaseAiReservation: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('test-api-key'),
            get: jest.fn().mockReturnValue(undefined),
          },
        },
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: LimitsService,
          useValue: limits,
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
  });

  const fakeUserId = 'user-1';
  const fakeBuffer = Buffer.from('fake-image-data');
  const fakeMime = 'image/jpeg';

  // Gemini response: `response.text` (JSON) + grounding metadata. `grounded:false`
  // simulates the model skipping search (no web_search_queries) → triggers fallback.
  function makeGeminiResponse(
    payload: Record<string, unknown>,
    { grounded = true }: { grounded?: boolean } = {},
  ) {
    return {
      text: JSON.stringify(payload),
      candidates: [
        { groundingMetadata: { webSearchQueries: grounded ? ['camisa retrô preço'] : [] } },
      ],
    };
  }

  function makeOpenAIResponse(content: string) {
    return { choices: [{ message: { content } }] };
  }

  const geminiPayload = {
    name: 'Camisa Retrô',
    category: 'Eletrônicos',
    description: 'Uma camisa retrô em bom estado.',
    price_min: 40,
    price_max: 90,
    price_confidence: 'high',
    price_evidence: [{ title: 'Camisa usada', price: 55, url: 'https://olx.com.br/x' }],
  };

  describe('grounded Gemini path (primary)', () => {
    it('returns the grounded result, with confidence and evidence, and does not call OpenAI', async () => {
      mockGenerate.mockResolvedValue(makeGeminiResponse(geminiPayload));

      const result = await service.analyze(fakeUserId, fakeBuffer, fakeMime);

      expect(result.name).toBe('Camisa Retrô');
      expect(result.category).toBe('Eletrônicos');
      expect(result.category_id).toBe('uuid-1');
      expect(result.description).toBe('Uma camisa retrô em bom estado.');
      expect(result.price_min).toBe(40);
      expect(result.price_max).toBe(90);
      expect(result.price_confidence).toBe('high');
      expect(result.price_evidence).toEqual([
        { title: 'Camisa usada', price: 55, url: 'https://olx.com.br/x' },
      ]);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('resolves category_id case-insensitively', async () => {
      mockGenerate.mockResolvedValue(makeGeminiResponse({ ...geminiPayload, category: 'móveis' }));

      const result = await service.analyze(fakeUserId, fakeBuffer, fakeMime);

      expect(result.category).toBe('Móveis');
      expect(result.category_id).toBe('uuid-2');
    });

    it('sets category_id to null when the model returns null for category', async () => {
      mockGenerate.mockResolvedValue(makeGeminiResponse({ ...geminiPayload, category: null }));

      const result = await service.analyze(fakeUserId, fakeBuffer, fakeMime);

      expect(result.category).toBeNull();
      expect(result.category_id).toBeNull();
    });

    it('sets category and category_id to null for an unrecognized category name', async () => {
      mockGenerate.mockResolvedValue(
        makeGeminiResponse({ ...geminiPayload, category: 'CategoriaDesconhecida' }),
      );

      const result = await service.analyze(fakeUserId, fakeBuffer, fakeMime);

      expect(result.category).toBeNull();
      expect(result.category_id).toBeNull();
    });

    it('swaps price_min and price_max when out of order', async () => {
      mockGenerate.mockResolvedValue(
        makeGeminiResponse({ ...geminiPayload, price_min: 500, price_max: 100 }),
      );

      const result = await service.analyze(fakeUserId, fakeBuffer, fakeMime);

      expect(result.price_min).toBe(100);
      expect(result.price_max).toBe(500);
    });

    it('defaults price_confidence to "medium" when the grounded model omits it', async () => {
      const withoutConfidence = { ...geminiPayload };
      delete (withoutConfidence as { price_confidence?: string }).price_confidence;
      mockGenerate.mockResolvedValue(makeGeminiResponse(withoutConfidence));

      const result = await service.analyze(fakeUserId, fakeBuffer, fakeMime);

      expect(result.price_confidence).toBe('medium');
    });

    it('drops malformed price_evidence entries', async () => {
      mockGenerate.mockResolvedValue(
        makeGeminiResponse({
          ...geminiPayload,
          price_evidence: [
            { title: 'Válido', price: 55, url: 'https://olx.com.br/x' },
            { title: 'Sem url', price: 55 },
            { price: 55, url: 'https://olx.com.br/y' },
            'not-an-object',
          ],
        }),
      );

      const result = await service.analyze(fakeUserId, fakeBuffer, fakeMime);

      expect(result.price_evidence).toEqual([
        { title: 'Válido', price: 55, url: 'https://olx.com.br/x' },
      ]);
    });

    it('sends the image, the search instruction, the categories, and the googleSearch tool', async () => {
      mockGenerate.mockResolvedValue(makeGeminiResponse(geminiPayload));

      await service.analyze(fakeUserId, fakeBuffer, fakeMime);

      const arg = mockGenerate.mock.calls[0][0];
      const promptText = arg.contents[0].parts[1].text as string;
      expect(promptText).toContain('ONE single web search');
      expect(promptText).toContain('Eletrônicos');
      expect(promptText).toContain('Móveis');
      expect(arg.config.tools).toEqual([{ googleSearch: {} }]);
      expect(arg.config.responseMimeType).toBe('application/json');
    });
  });

  describe('OpenAI fallback', () => {
    it('falls back to OpenAI (confidence "low", no evidence) when Gemini throws', async () => {
      mockGenerate.mockRejectedValue(new Error('Gemini 500'));
      mockCreate.mockResolvedValue(
        makeOpenAIResponse(
          JSON.stringify({
            name: 'Notebook',
            category: 'Eletrônicos',
            description: 'Um notebook.',
            price_min: 2000,
            price_max: 5000,
          }),
        ),
      );

      const result = await service.analyze(fakeUserId, fakeBuffer, fakeMime);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(result.name).toBe('Notebook');
      expect(result.category_id).toBe('uuid-1');
      expect(result.price_confidence).toBe('low');
      expect(result.price_evidence).toEqual([]);
    });

    it('falls back to OpenAI when Gemini returns an ungrounded result', async () => {
      mockGenerate.mockResolvedValue(makeGeminiResponse(geminiPayload, { grounded: false }));
      mockCreate.mockResolvedValue(
        makeOpenAIResponse(
          JSON.stringify({
            name: 'Item',
            category: null,
            description: 'Descrição.',
            price_min: 10,
            price_max: 50,
          }),
        ),
      );

      const result = await service.analyze(fakeUserId, fakeBuffer, fakeMime);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(result.price_confidence).toBe('low');
    });

    it('throws ServiceUnavailableException when both providers fail', async () => {
      mockGenerate.mockRejectedValue(new Error('Gemini down'));
      mockCreate.mockRejectedValue(new Error('OpenAI down'));

      await expect(service.analyze(fakeUserId, fakeBuffer, fakeMime)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('throws ServiceUnavailableException when Gemini is ungrounded and OpenAI returns invalid JSON', async () => {
      mockGenerate.mockResolvedValue(makeGeminiResponse(geminiPayload, { grounded: false }));
      mockCreate.mockResolvedValue(makeOpenAIResponse('not valid json at all'));

      await expect(service.analyze(fakeUserId, fakeBuffer, fakeMime)).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });

  describe('quota reservation', () => {
    it('reserves before analysis and does not release on success', async () => {
      mockGenerate.mockResolvedValue(makeGeminiResponse(geminiPayload));

      await service.analyze(fakeUserId, fakeBuffer, fakeMime);

      expect(limits.reserveAiCall).toHaveBeenCalledWith(fakeUserId);
      expect(limits.releaseAiReservation).not.toHaveBeenCalled();
    });

    it('releases the reservation when both providers fail', async () => {
      mockGenerate.mockRejectedValue(new Error('Gemini down'));
      mockCreate.mockRejectedValue(new Error('OpenAI down'));

      await expect(service.analyze(fakeUserId, fakeBuffer, fakeMime)).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(limits.releaseAiReservation).toHaveBeenCalledWith(fakeUserId);
    });

    it('does not release when no reservation was made (premium)', async () => {
      limits.reserveAiCall.mockResolvedValue(false);
      mockGenerate.mockRejectedValue(new Error('Gemini down'));
      mockCreate.mockRejectedValue(new Error('OpenAI down'));

      await expect(service.analyze(fakeUserId, fakeBuffer, fakeMime)).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(limits.releaseAiReservation).not.toHaveBeenCalled();
    });

    it('rejects with ForbiddenException when the AI monthly limit is reached, calling neither provider', async () => {
      limits.reserveAiCall.mockRejectedValue(
        new ForbiddenException({ code: 'LIMIT_REACHED', limit: 10 }),
      );

      await expect(service.analyze(fakeUserId, fakeBuffer, fakeMime)).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockGenerate).not.toHaveBeenCalled();
      expect(mockCreate).not.toHaveBeenCalled();
      expect(limits.releaseAiReservation).not.toHaveBeenCalled();
    });
  });
});
