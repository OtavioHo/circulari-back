# AI Integration <Badge type="tip" text="Implemented" />

## Model

OpenAI Vision — **GPT-4o** by default. Configurable via the `OPENAI_VISION_MODEL`
env var (any vision-capable OpenAI model). Images are sent with `detail: "high"`
for more reliable item recognition.

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

A **system prompt** frames the model as an appraiser of second-hand goods for a
Brazilian marketplace, instructing it to judge visible condition and price the
item against the realistic used-goods market in BRL.

A **user prompt** (built dynamically with the current category list injected at
call time) asks for the item name, best-matching category (or null), a pt-BR
description including condition, and a sensible second-hand `price_min`/`price_max`
range.

### Structured Outputs

The response shape is enforced with OpenAI **Structured Outputs**
(`response_format: json_schema`, `strict: true`) rather than free-form JSON, so
the returned fields can't drift. When categories exist, `category` is constrained
to an `enum` of the valid names (plus `null`), pushing the model to pick a real
category. Fields: `name`, `category`, `description`, `price_min`, `price_max`.

## Category Matching

After the AI returns a category name, the backend resolves `category_id`:
- The returned name is matched case-insensitively against the fetched category list.
- If a match is found, `category_id` is set to that category's UUID and `category` is normalized to the stored name.
- If `null` is returned or the name is unrecognized, both `category` and `category_id` are `null`.

## Price Normalization

After receiving AI response:
1. Swap `price_min` and `price_max` if out of order (`price_min > price_max`)
2. If AI fails, return error — client handles fallback (manual entry)
