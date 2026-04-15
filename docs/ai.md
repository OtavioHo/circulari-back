# AI Integration <Badge type="tip" text="Implemented" />

## Model

OpenAI API — GPT-4o-mini (default) or GPT-4o

## Flow

```
POST /ai/analyze (image)
  └─► DB: fetch all categories (id, name)
        └─► OpenAI Vision API (prompt includes category list)
              └─► Returns { name, category, description, price_min, price_max }
                    └─► Backend resolves category_id (case-insensitive match)
                          └─► Backend normalizes prices
                                └─► Returns suggestions to client

User reviews/edits suggestions
  └─► POST /items (final data + image)
        └─► Backend uploads image to S3/R2
              └─► Item + ItemImage saved to DB
```

AI is a **separate step** before item creation. The client sends the image to `/ai/analyze`, shows suggestions for review/edit, then submits the final data along with the image to `POST /items`, which handles storage.

## Prompt

The prompt is built dynamically with the current category list injected at call time:

```
Analyze the image and return a JSON object with the following fields:
- name: item name in Portuguese (Brazil)
- category: pick the single most fitting category from this list, or null if none fit: ["Móveis","Eletrônicos", ...]
- description: brief item description in one paragraph, in Portuguese (Brazil)
- price_min: minimum market value in BRL (number)
- price_max: maximum market value in BRL (number)

Return only valid JSON, no explanation:
{ "name": "", "category": null, "description": "", "price_min": 0, "price_max": 0 }
```

## Category Matching

After the AI returns a category name, the backend resolves `category_id`:
- The returned name is matched case-insensitively against the fetched category list.
- If a match is found, `category_id` is set to that category's UUID and `category` is normalized to the stored name.
- If `null` is returned or the name is unrecognized, both `category` and `category_id` are `null`.

## Price Normalization

After receiving AI response:
1. Swap `price_min` and `price_max` if out of order (`price_min > price_max`)
2. If AI fails, return error — client handles fallback (manual entry)
