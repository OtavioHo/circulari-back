# Data Models

## User

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| email | string | unique |
| password_hash | string | bcrypt, nullable (social-only users) |
| name | string | |
| photo_url | string | nullable |
| oauth_provider | string | nullable, e.g. "google", "apple" |
| oauth_id | string | nullable, provider-specific user ID |
| refresh_token_hash | string | nullable, bcrypt hash of current refresh token |
| tier | string | `"free"` or `"premium"`; default `"free"`. Updated by RevenueCat webhooks and login reconciliation. |
| created_at | timestamp | |

## ListColor

Global reference data — seeded on `prisma:seed`. Controls the color palette available when creating or editing a list.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| name | string | unique; e.g. "Vermelho", "Azul" |
| hex_code | string | CSS hex color, e.g. `#EF4444` |
| order | integer | display order in the palette; default 0 |

## ListIcon

Global reference data — seeded on `prisma:seed`. Controls the icon set available when creating or editing a list.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| name | string | unique; human-readable name, e.g. "Carrinho" |
| slug | string | unique; icon key for the frontend, e.g. `shopping-cart` |
| order | integer | display order in the picker; default 0 |

## List

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users |
| name | string | |
| location | string | nullable, plain text address |
| color_id | uuid | FK → list_colors; non-nullable |
| icon_id | uuid | FK → list_icons; non-nullable |
| created_at | timestamp | |

## Item

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| list_id | uuid | FK → lists |
| name | string | AI-suggested or user-defined |
| description | string | nullable |
| quantity | integer | default 1 |
| category_id | uuid | FK → categories, nullable; set to null when category deleted |
| user_defined_value | decimal | user override; AI price used if null |
| created_at | timestamp | |

## Category

Global reference data — seeded on `prisma:seed`, no CRUD endpoints exposed.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| name | string | unique; e.g. "Eletrônicos", "Roupas e Acessórios" |

## ItemImage

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| item_id | uuid | FK → items, cascades on delete |
| url | string | S3/R2 public URL |
| storage_key | string | Object storage key (e.g. `items/{itemId}/{uuid}.jpg`); retained for future deletion |
| is_main | boolean | True for the item's primary display image; default false |
| created_at | timestamp | |

## AiUsage

Per-user, per-month counter for AI-analysis calls. Resets implicitly each month by using a new row (unique on `(user_id, month)`).

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users, cascades on delete |
| month | string | `"YYYY-MM"` (UTC) |
| call_count | integer | Incremented on each successful `/ai/analyze` |

## ProcessedWebhookEvent

Dedup record for idempotent webhook processing. One row per `(provider, event_id)` we've handled — subsequent retries are short-circuited.

| Field | Type | Notes |
|-------|------|-------|
| provider | string | Part of composite PK; `"revenuecat"` today, reserved for future providers |
| event_id | string | Part of composite PK; external event identifier |
| processed_at | timestamp | |
