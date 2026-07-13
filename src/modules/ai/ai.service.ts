import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import { PrismaService } from '../prisma/prisma.service';
import { LimitsService } from '../tiers/limits.service';

// Gemini (primary) is prompted to ANCHOR the price to real used listings it
// finds via Google Search grounding, not to its own frozen guess.
const GEMINI_SYSTEM_PROMPT = `You are an expert appraiser of second-hand and resale goods for a Brazilian online marketplace.
From a single photo you identify the main item and estimate its realistic resale value in the Brazilian used-goods market (in BRL).
Always assess the item's visible condition (new, lightly used, worn, damaged) and let it drive the price.
Anchor the price to real USED listings you find via web search on Brazilian marketplaces, not to your own guess.
Write all user-facing text (name, description) in natural Brazilian Portuguese (pt-BR).`;

// OpenAI (fallback) has no live data — it prices from training knowledge only.
const OPENAI_SYSTEM_PROMPT = `You are an expert appraiser of second-hand and resale goods for a Brazilian online marketplace.
From a single photo you identify the main item and estimate its realistic resale value in the Brazilian used-goods market (in BRL).
Always assess the item's visible condition (new, lightly used, worn, damaged) and let it drive the price.
Write all user-facing text (name, description) in natural Brazilian Portuguese (pt-BR).
Base prices on what this specific item, in its visible condition, actually sells for second-hand in Brazil — keep the range tight and realistic, not a wild guess.`;

function categoryList(categoryNames: string[]): string {
  return categoryNames.length > 0
    ? categoryNames.map((c) => `- ${c}`).join('\n')
    : '(no categories available)';
}

// Prompt for the grounded Gemini path. The single-search instruction keeps the
// model to ~1 search query per analysis (measured 5x cheaper than the naive
// prompt) while staying reliably grounded.
function buildGeminiPrompt(categoryNames: string[]): string {
  return `Analyze the photo and identify the single main item being sold.
Then run ONE single web search for comparable USED listings of this item on Brazilian marketplaces (mercadolivre.com.br / olx.com.br / enjoei.com.br) and price against them in BRL. Do NOT run multiple searches — one focused query is enough.

Then provide:
- name: a concise pt-BR product name (max ~6 words), specific enough to recognize (brand/model if visible).
- category: choose the single best-fitting category, matching one EXACTLY from the list below; use null only if none reasonably fit.
- description: one short pt-BR paragraph covering the item's key attributes and its visible condition.
- price_min / price_max: the realistic SECOND-HAND resale range in BRL, anchored to the used listings you found.
- price_confidence: "high" | "medium" | "low" — use "low" if you could not find comparable used listings.
- price_evidence: array of the comparable listings you used ({ title, price, url }); may be empty.

Categories:
${categoryList(categoryNames)}

If the photo does not clearly show a sellable item, still return your best guess with conservative (low) prices and price_confidence "low".`;
}

// Prompt for the ungrounded OpenAI fallback (no search available).
function buildOpenAiPrompt(categoryNames: string[]): string {
  return `Analyze the photo and identify the single main item being sold.

Then provide:
- name: a concise pt-BR product name (max ~6 words), specific enough to recognize (brand/model if visible).
- category: choose the single best-fitting category, matching one EXACTLY from the list below; use null only if none reasonably fit.
- description: one short pt-BR paragraph covering the item's key attributes and its visible condition.
- price_min / price_max: the realistic SECOND-HAND resale range in BRL for this item in its visible condition. Keep the spread sensible; if uncertain, give your best estimate rather than an extreme range.

Categories:
${categoryList(categoryNames)}

If the photo does not clearly show a sellable item, still return your best guess with conservative (low) prices.`;
}

// Gemini's JSON-schema subset rejects `type: ['string','null']` unions — it uses
// `nullable: true` instead — and does not take a `null` enum member.
function buildGeminiSchema(categoryNames: string[]): Record<string, unknown> {
  const category: Record<string, unknown> = {
    type: 'string',
    nullable: true,
    description: 'Exact category name from the provided list, or null if none fit.',
  };
  if (categoryNames.length > 0) {
    category.enum = [...categoryNames];
  }
  return {
    type: 'object',
    required: ['name', 'category', 'description', 'price_min', 'price_max', 'price_confidence'],
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
      price_confidence: {
        type: 'string',
        enum: ['high', 'medium', 'low'],
        description: 'Trust signal; "low" when no comparable used listings were found.',
      },
      price_evidence: {
        type: 'array',
        description:
          'Comparable used listings used to anchor the price (best-effort, may be empty).',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            price: { type: 'number' },
            url: { type: 'string' },
          },
        },
      },
    },
  };
}

// OpenAI Structured Outputs schema (fallback) — guarantees the response shape so
// parsing can't drift. The category enum (when categories exist) forces a valid pick.
function buildOpenAiSchema(categoryNames: string[]): Record<string, unknown> {
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

export type PriceConfidence = 'high' | 'medium' | 'low';

export interface PriceEvidence {
  title: string;
  price: number;
  url: string;
}

export interface AnalyzeResult {
  name: string;
  category: string | null;
  category_id: string | null;
  description: string;
  price_min: number;
  price_max: number;
  // Grounded-pricing trust signal. Grounded (Gemini) responses carry the model's
  // own high/medium/low; the ungrounded OpenAI fallback is always "low".
  price_confidence: PriceConfidence;
  // Comparable listings the price was anchored to. Best-effort — may be empty
  // (URLs from the model can be approximate); always empty on the fallback path.
  price_evidence: PriceEvidence[];
}

// Provider-agnostic parsed result, before category resolution / price ordering.
interface RawAnalysis {
  name: string;
  category: string | null;
  description: string;
  price_min: number;
  price_max: number;
  price_confidence: PriceConfidence;
  price_evidence: PriceEvidence[];
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    // Number('') and Number('   ') are 0 (finite) — reject empty input so a
    // missing price can't slip through as R$0.
    const trimmed = value.trim();
    return trimmed === '' ? NaN : Number(trimmed);
  }
  return NaN;
}

// Validate + normalize the core fields both providers must return. Throws on a
// malformed shape so the caller can fall back or fail gracefully.
function validateCore(
  parsed: Record<string, unknown>,
): Omit<RawAnalysis, 'price_confidence' | 'price_evidence'> {
  const name = typeof parsed.name === 'string' ? parsed.name.trim() : '';
  const category =
    parsed.category === null
      ? null
      : typeof parsed.category === 'string'
        ? parsed.category.trim() || null
        : null;
  const description = typeof parsed.description === 'string' ? parsed.description.trim() : '';
  const price_min = toNumber(parsed.price_min);
  const price_max = toNumber(parsed.price_max);

  if (
    !name ||
    !description ||
    !isFinite(price_min) ||
    !isFinite(price_max) ||
    price_min < 0 ||
    price_max < 0
  ) {
    throw new Error(`Invalid AI response shape: ${JSON.stringify(parsed)}`);
  }
  return { name, category, description, price_min, price_max };
}

function parseConfidence(value: unknown): PriceConfidence | null {
  return value === 'high' || value === 'medium' || value === 'low' ? value : null;
}

function parseEvidence(value: unknown): PriceEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry): PriceEvidence[] => {
    if (!entry || typeof entry !== 'object') return [];
    const e = entry as Record<string, unknown>;
    const title = typeof e.title === 'string' ? e.title.trim() : '';
    const url = typeof e.url === 'string' ? e.url.trim() : '';
    const price = toNumber(e.price);
    if (!title || !url || !isFinite(price) || price < 0) return [];
    return [{ title, price, url }];
  });
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  // null when GEMINI_API_KEY is unset — the service degrades to OpenAI-only
  // rather than failing to boot.
  private readonly genai: GoogleGenAI | null;
  private readonly openai: OpenAI;
  private readonly geminiModel: string;
  private readonly openaiModel: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly limits: LimitsService,
  ) {
    // Gemini (grounded) is the primary path but optional: without a key the
    // service degrades to the ungrounded OpenAI path instead of crashing the
    // whole app on boot. 45s timeout bounds the synchronous request (grounded
    // Flash calls measured 9-37s) while leaving room for the fallback below.
    const geminiApiKey = this.config.get<string>('GEMINI_API_KEY');
    this.genai = geminiApiKey
      ? new GoogleGenAI({ apiKey: geminiApiKey, httpOptions: { timeout: 45_000 } })
      : null;
    if (!this.genai) {
      this.logger.warn('GEMINI_API_KEY not set — grounded pricing disabled, using OpenAI only');
    }
    this.geminiModel = this.config.get<string>('GEMINI_MODEL') ?? 'gemini-3-flash-preview';

    this.openai = new OpenAI({
      apiKey: this.config.getOrThrow<string>('OPENAI_API_KEY'),
    });
    this.openaiModel = this.config.get<string>('OPENAI_VISION_MODEL') ?? 'gpt-4o';
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

    // Primary: grounded Gemini (when configured). On any failure — including an
    // ungrounded response (no search queries) — fall back to the ungrounded
    // OpenAI call so the request still succeeds (graceful degradation).
    let raw: RawAnalysis;
    if (this.genai) {
      try {
        raw = await this.analyzeWithGemini(imageBuffer, mimetype, categoryNames);
      } catch (geminiErr) {
        const message = geminiErr instanceof Error ? geminiErr.message : String(geminiErr);
        this.logger.warn(
          `Gemini grounded analysis unavailable, falling back to OpenAI: ${message}`,
        );
        raw = await this.runOpenAiFallback(imageBuffer, mimetype, categoryNames);
      }
    } else {
      raw = await this.runOpenAiFallback(imageBuffer, mimetype, categoryNames);
    }

    const matched = raw.category
      ? categories.find((c) => c.name.toLowerCase() === raw.category!.toLowerCase())
      : undefined;

    const result: AnalyzeResult = {
      name: raw.name,
      category: matched ? matched.name : null,
      category_id: matched ? matched.id : null,
      description: raw.description,
      price_min: raw.price_min,
      price_max: raw.price_max,
      price_confidence: raw.price_confidence,
      price_evidence: raw.price_evidence,
    };

    if (result.price_min > result.price_max) {
      [result.price_min, result.price_max] = [result.price_max, result.price_min];
    }

    return result;
  }

  // Runs the OpenAI fallback and maps any failure to a 503 — this is the last
  // resort, so if it also fails the whole analysis fails.
  private async runOpenAiFallback(
    imageBuffer: Buffer,
    mimetype: string,
    categoryNames: string[],
  ): Promise<RawAnalysis> {
    try {
      return await this.analyzeWithOpenAI(imageBuffer, mimetype, categoryNames);
    } catch (openaiErr) {
      const trace =
        openaiErr instanceof Error ? (openaiErr.stack ?? openaiErr.message) : String(openaiErr);
      this.logger.error('AI analysis failed (OpenAI fallback)', trace);
      throw new ServiceUnavailableException('AI analysis failed');
    }
  }

  // Grounded path: one generateContent call does vision + Google Search + JSON.
  // Throws if the model returned no search queries — an ungrounded price is no
  // better than the fallback, so we don't trust it (and the model's self-reported
  // price_confidence is unreliable when it didn't actually search).
  private async analyzeWithGemini(
    imageBuffer: Buffer,
    mimetype: string,
    categoryNames: string[],
  ): Promise<RawAnalysis> {
    // Guarded by the caller, but keep the null-check local so the type narrows.
    const genai = this.genai;
    if (!genai) {
      throw new Error('Gemini client not configured');
    }
    const response = await genai.models.generateContent({
      model: this.geminiModel,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: mimetype, data: imageBuffer.toString('base64') } },
            { text: buildGeminiPrompt(categoryNames) },
          ],
        },
      ],
      config: {
        systemInstruction: GEMINI_SYSTEM_PROMPT,
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
        responseJsonSchema: buildGeminiSchema(categoryNames),
        temperature: 0,
        // Visible JSON output measured ~300-400 tokens; 2048 leaves ample
        // headroom for a populated price_evidence array without truncation.
        maxOutputTokens: 2048,
      },
    });

    const searchQueries = response.candidates?.[0]?.groundingMetadata?.webSearchQueries ?? [];
    if (searchQueries.length === 0) {
      throw new Error('Gemini returned an ungrounded result (no web_search_queries)');
    }

    const text = response.text;
    if (!text) {
      throw new Error('Gemini returned an empty response');
    }

    const parsed = JSON.parse(text) as Record<string, unknown>;
    const core = validateCore(parsed);
    return {
      ...core,
      price_confidence: parseConfidence(parsed.price_confidence) ?? 'medium',
      price_evidence: parseEvidence(parsed.price_evidence),
    };
  }

  // Ungrounded fallback: the original gpt-4o vision call. Prices come from the
  // model's training knowledge only, so confidence is always "low" and there is
  // no evidence to attach.
  private async analyzeWithOpenAI(
    imageBuffer: Buffer,
    mimetype: string,
    categoryNames: string[],
  ): Promise<RawAnalysis> {
    const dataUrl = `data:${mimetype};base64,${imageBuffer.toString('base64')}`;

    const response = await this.openai.chat.completions.create(
      {
        model: this.openaiModel,
        messages: [
          { role: 'system', content: OPENAI_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: buildOpenAiPrompt(categoryNames) },
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
            schema: buildOpenAiSchema(categoryNames),
          },
        },
        temperature: 0,
      },
      // 20s: this runs after the 45s Gemini attempt, so keep the combined
      // worst case (~65s) under typical gateway/client request timeouts.
      { timeout: 20_000 },
    );

    const raw = response.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const core = validateCore(parsed);
    return {
      ...core,
      price_confidence: 'low',
      price_evidence: [],
    };
  }
}
