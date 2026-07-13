# AI Integration <Badge type="tip" text="Implemented" />

## Model

**Primary — Google Gemini with Google Search grounding.** `gemini-3-flash-preview`
by default (configurable via `GEMINI_MODEL`; must support grounding + structured
output). A single `generateContent` call does vision + web search + structured
JSON, so the price is **anchored to real Brazilian second-hand listings** (Mercado
Livre / OLX / Enjoei) rather than being an ungrounded guess. Uses the native
`@google/genai` SDK.

**Fallback — OpenAI Vision** (`gpt-4o` by default, `OPENAI_VISION_MODEL`). Used
whenever the grounded call fails, **comes back ungrounded**, or **`GEMINI_API_KEY`
is unset** (grounded pricing is optional — without a key the service degrades to
OpenAI-only rather than failing to boot). Its prices come from training knowledge
only, so results on this path are always marked `price_confidence: "low"`.

> **Billing:** Gemini grounding requires a **billing-enabled project with a
> non-zero prepay balance** — it returns `429` on the free tier. See
> [infra](./infra) for the `GEMINI_API_KEY` / `OPENAI_API_KEY` secrets.

## Flow

```
POST /ai/analyze (image)
  └─► DB: fetch all categories (id, name)
        └─► Gemini: generateContent(image + googleSearch + responseJsonSchema)   ← grounded, single call
              │      Returns { name, category, description, price_min, price_max,
              │                price_confidence, price_evidence[] } + groundingMetadata
              ├─ grounded (web_search_queries > 0) ─► use result
              └─ error OR ungrounded ─► OpenAI Vision fallback (price_confidence forced "low")
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
item against the realistic used-goods market in BRL. The Gemini system prompt
additionally tells it to **anchor the price to real used listings found via search**.

A **user prompt** (built dynamically with the current category list injected at
call time) asks for the item name, best-matching category (or null), a pt-BR
description including condition, and a sensible second-hand `price_min`/`price_max`
range. The **Gemini prompt** adds a **single-search instruction** ("run ONE focused
web search … do NOT run multiple") — this keeps the model to ~1 search query per
analysis, which is materially cheaper (Gemini 3 bills per search query) while
staying reliably grounded.

### Structured Outputs

Both providers enforce the response shape with structured output rather than
free-form JSON, so the returned fields can't drift.

- **Gemini** uses `responseMimeType: 'application/json'` + `responseJsonSchema`.
  Its schema subset requires `nullable: true` (not `type: ['string','null']`) and
  no `null` enum member. Fields: `name`, `category`, `description`, `price_min`,
  `price_max`, **`price_confidence`**, **`price_evidence[]`**.
- **OpenAI** (fallback) uses **Structured Outputs** (`response_format: json_schema`,
  `strict: true`). Fields: `name`, `category`, `description`, `price_min`,
  `price_max` (no confidence/evidence — set by the backend).

When categories exist, `category` is constrained to an `enum` of the valid names,
pushing the model to pick a real category.

## Grounding & Fallback

The trust signal is **derived from grounding metadata, not the model's
self-report**: a grounded response has `groundingMetadata.web_search_queries.length > 0`.
The model's own `price_confidence` is not trusted on its own — a model can return
`"medium"` while having skipped search entirely.

- **Grounded** (search queries present): use the Gemini result, keeping its
  `price_confidence` (default `"medium"` if omitted) and best-effort `price_evidence`.
- **Ungrounded or errored**: fall back to the OpenAI vision call and force
  `price_confidence: "low"` with empty `price_evidence`.
- **Both fail**: return `503` — client handles fallback (manual entry).

`price_evidence` is **best-effort**: comparable listings the price was anchored to,
`[{ title, price, url }]`. URLs from the model can be approximate, so treat it as a
display nicety, not guaranteed-clickable citations. It is always empty on the
fallback path.

**Timeout:** the Gemini client uses a **45s** timeout (grounded Flash calls measured
9–37s); the OpenAI fallback uses **20s**. Because the fallback runs after a failed
Gemini attempt, this bounds the combined worst case at ~65s — under typical
gateway/client request timeouts. The `POST /ai/analyze` flow stays synchronous.

## Category Matching

After the AI returns a category name, the backend resolves `category_id`:
- The returned name is matched case-insensitively against the fetched category list.
- If a match is found, `category_id` is set to that category's UUID and `category` is normalized to the stored name.
- If `null` is returned or the name is unrecognized, both `category` and `category_id` are `null`.

## Price Normalization

After receiving the AI response:
1. Swap `price_min` and `price_max` if out of order (`price_min > price_max`)
2. If both providers fail, return error — client handles fallback (manual entry)
