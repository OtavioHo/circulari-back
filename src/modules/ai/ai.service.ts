import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { LimitsService } from '../tiers/limits.service';
import OpenAI from 'openai';

const SYSTEM_PROMPT = `You are an expert appraiser of second-hand and resale goods for a Brazilian online marketplace.
From a single photo you identify the main item and estimate its realistic resale value in the Brazilian used-goods market (in BRL).
Always assess the item's visible condition (new, lightly used, worn, damaged) and let it drive the price.
Write all user-facing text (name, description) in natural Brazilian Portuguese (pt-BR).
Base prices on what this specific item, in its visible condition, actually sells for second-hand in Brazil — keep the range tight and realistic, not a wild guess.`;

function buildPrompt(categoryNames: string[]): string {
  const list =
    categoryNames.length > 0
      ? categoryNames.map((c) => `- ${c}`).join('\n')
      : '(no categories available)';
  return `Analyze the photo and identify the single main item being sold.

Then provide:
- name: a concise pt-BR product name (max ~6 words), specific enough to recognize (brand/model if visible).
- category: choose the single best-fitting category, matching one EXACTLY from the list below; use null only if none reasonably fit.
- description: one short pt-BR paragraph covering the item's key attributes and its visible condition.
- price_min / price_max: the realistic SECOND-HAND resale range in BRL for this item in its visible condition. Keep the spread sensible; if uncertain, give your best estimate rather than an extreme range.

Categories:
${list}

If the photo does not clearly show a sellable item, still return your best guess with conservative (low) prices.`;
}

// OpenAI Structured Outputs schema — guarantees the response shape so parsing
// can't drift. The category enum (when categories exist) forces a valid pick.
function buildSchema(categoryNames: string[]): Record<string, unknown> {
  const category: Record<string, unknown> = {
    type: ['string', 'null'],
    description: 'Exact category name from the provided list, or null if none fit.',
  };
  if (categoryNames.length > 0) {
    category.enum = [...categoryNames, null];
  }
  return {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'category', 'description', 'price_min', 'price_max'],
    properties: {
      name: { type: 'string', description: 'Concise pt-BR item name, max ~6 words.' },
      category,
      description: {
        type: 'string',
        description: 'One short pt-BR paragraph: key attributes and visible condition.',
      },
      price_min: {
        type: 'number',
        description: 'Lower bound of realistic second-hand resale value in BRL.',
      },
      price_max: {
        type: 'number',
        description: 'Upper bound of realistic second-hand resale value in BRL.',
      },
    },
  };
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
  private readonly model: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly limits: LimitsService,
  ) {
    this.openai = new OpenAI({
      apiKey: this.config.getOrThrow<string>('OPENAI_API_KEY'),
    });
    this.model = this.config.get<string>('OPENAI_VISION_MODEL') ?? 'gpt-4o';
  }

  async analyze(userId: string, imageBuffer: Buffer, mimetype: string): Promise<AnalyzeResult> {
    const reserved = await this.limits.reserveAiCall(userId);
    let success = false;
    try {
      const result = await this.runAnalysis(userId, imageBuffer, mimetype);
      success = true;
      return result;
    } finally {
      if (!success && reserved) {
        try {
          await this.limits.releaseAiReservation(userId);
        } catch (err) {
          this.logger.error(
            `Failed to release AI reservation for user ${userId} after analysis failure`,
            err instanceof Error ? err.stack : String(err),
          );
        }
      }
    }
  }

  private async runAnalysis(
    _userId: string,
    imageBuffer: Buffer,
    mimetype: string,
  ): Promise<AnalyzeResult> {
    let categories: Array<{ id: string; name: string }>;

    try {
      categories = await this.prisma.category.findMany({ select: { id: true, name: true } });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Category lookup failed: ${message}`,
        err instanceof Error ? err.stack : undefined,
      );
      throw new ServiceUnavailableException('Category lookup failed');
    }

    const categoryNames = categories.map((c) => c.name);

    try {
      const base64 = imageBuffer.toString('base64');
      const dataUrl = `data:${mimetype};base64,${base64}`;

      const response = await this.openai.chat.completions.create(
        {
          model: this.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: buildPrompt(categoryNames) },
                { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
              ],
            },
          ],
          max_tokens: 600,
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'item_analysis',
              strict: true,
              schema: buildSchema(categoryNames),
            },
          },
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
