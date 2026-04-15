import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import OpenAI from 'openai';

function buildPrompt(categoryNames: string[]): string {
  const list = JSON.stringify(categoryNames);
  return `Analyze the image and return a JSON object with the following fields:
- name: item name in Portuguese (Brazil)
- category: pick the single most fitting category from this list, or null if none fit: ${list}
- description: brief item description in one paragraph, in Portuguese (Brazil)
- price_min: minimum market value in BRL (number)
- price_max: maximum market value in BRL (number)

Return only valid JSON, no explanation:
{ "name": "", "category": null, "description": "", "price_min": 0, "price_max": 0 }`;
}

export interface AnalyzeResult {
  name: string;
  category: string | null;
  category_id: string | null;
  description: string;
  price_min: number;
  price_max: number;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openai: OpenAI;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.config.getOrThrow<string>('OPENAI_API_KEY'),
    });
  }

  async analyze(imageBuffer: Buffer, mimetype: string): Promise<AnalyzeResult> {
    try {
      const categories = await this.prisma.category.findMany({ select: { id: true, name: true } });
      const categoryNames = categories.map((c) => c.name);

      const base64 = imageBuffer.toString('base64');
      const dataUrl = `data:${mimetype};base64,${base64}`;

      const response = await this.openai.chat.completions.create(
        {
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: buildPrompt(categoryNames) },
                { type: 'image_url', image_url: { url: dataUrl } },
              ],
            },
          ],
          max_tokens: 512,
          response_format: { type: 'json_object' },
          temperature: 0,
        },
        { timeout: 30_000 },
      );

      const raw = response.choices[0]?.message?.content ?? '';
      const parsed = JSON.parse(raw) as Record<string, unknown>;

      const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
      const categoryRaw =
        parsed.category === null
          ? null
          : typeof parsed.category === 'string'
            ? parsed.category.trim() || null
            : null;
      const description = typeof parsed.description === 'string' ? parsed.description.trim() : '';
      const price_min =
        typeof parsed.price_min === 'number' || typeof parsed.price_min === 'string'
          ? Number(parsed.price_min)
          : NaN;
      const price_max =
        typeof parsed.price_max === 'number' || typeof parsed.price_max === 'string'
          ? Number(parsed.price_max)
          : NaN;

      if (!name || !description || !isFinite(price_min) || !isFinite(price_max)) {
        throw new Error(`Invalid AI response shape: ${raw}`);
      }

      const matched = categoryRaw
        ? categories.find((c) => c.name.toLowerCase() === categoryRaw.toLowerCase())
        : undefined;

      const category = matched ? matched.name : null;
      const category_id = matched ? matched.id : null;

      const result: AnalyzeResult = {
        name,
        category,
        category_id,
        description,
        price_min,
        price_max,
      };

      if (result.price_min > result.price_max) {
        [result.price_min, result.price_max] = [result.price_max, result.price_min];
      }

      return result;
    } catch (err) {
      const trace = err instanceof Error ? (err.stack ?? err.message) : String(err);
      this.logger.error('AI analysis failed', trace);
      throw new ServiceUnavailableException('AI analysis failed');
    }
  }
}
