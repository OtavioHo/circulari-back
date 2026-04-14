import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

const ANALYZE_PROMPT = `Analyze the image and return a JSON object with the following fields:
- name: item name in Portuguese (Brazil)
- category: item category in Portuguese (Brazil)
- price_min: minimum market value in BRL (number)
- price_max: maximum market value in BRL (number)

Return only valid JSON, no explanation:
{ "name": "", "category": "", "price_min": 0, "price_max": 0 }`;

export interface AnalyzeResult {
  name: string;
  category: string;
  price_min: number;
  price_max: number;
}

@Injectable()
export class AiService {
  private readonly openai: OpenAI;

  constructor(private readonly config: ConfigService) {
    this.openai = new OpenAI({
      apiKey: this.config.getOrThrow<string>('OPENAI_API_KEY'),
    });
  }

  async analyze(imageBuffer: Buffer, mimetype: string): Promise<AnalyzeResult> {
    try {
      const base64 = imageBuffer.toString('base64');
      const dataUrl = `data:${mimetype};base64,${base64}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: ANALYZE_PROMPT },
              { type: 'image_url', image_url: { url: dataUrl } },
            ],
          },
        ],
        max_tokens: 256,
      });

      const raw = response.choices[0]?.message?.content ?? '';
      const parsed = JSON.parse(raw) as AnalyzeResult;

      if (parsed.price_min > parsed.price_max) {
        [parsed.price_min, parsed.price_max] = [parsed.price_max, parsed.price_min];
      }

      return parsed;
    } catch {
      throw new ServiceUnavailableException('AI analysis failed');
    }
  }
}
