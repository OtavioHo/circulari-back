# AI Integration <Badge type="danger" text="Not Implemented" />

## Model

OpenAI API — GPT-4o-mini (default) or GPT-4o

## Flow

```
POST /ai/analyze (image)
  └─► OpenAI Vision API
        └─► Returns { name, category, price_min, price_max }
              └─► Backend normalizes prices
                    └─► Returns suggestions to client

User reviews/edits suggestions
  └─► POST /items (final data + image)
        └─► Backend uploads image to S3/R2
              └─► Item + ItemImage saved to DB
```

AI is a **separate step** before item creation. The client sends the image to `/ai/analyze`, shows suggestions for review/edit, then submits the final data along with the image to `POST /items`, which handles storage.

## Prompt

```
Analyze the image and return a JSON object with the following fields:
- name: item name in Portuguese (Brazil)
- category: item category in Portuguese (Brazil)
- price_min: minimum market value in BRL (number)
- price_max: maximum market value in BRL (number)

Return only valid JSON, no explanation:
{ "name": "", "category": "", "price_min": 0, "price_max": 0 }
```

## Price Normalization

After receiving AI response:
1. Validate `price_min <= price_max`
2. Detect and adjust outliers (compare against category average)
3. If AI fails, return error — client handles fallback (manual entry)
