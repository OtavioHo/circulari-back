# API

Base URL: `/api/v1`
Auth: `Authorization: Bearer <jwt>` required on all routes except `/auth/register`, `/auth/login`, `/auth/refresh`, `/health`, and `/webhooks/revenuecat` (secret-authenticated)

---

## Auth <Badge type="warning" text="In Progress" />

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/register | Email + password registration |
| POST | /auth/login | Returns JWT + refresh token |
| POST | /auth/refresh | Exchange refresh token for new token pair |
| POST | /auth/logout | Invalidate refresh token |
| POST | /auth/social | Google / Apple OAuth (not yet implemented) |

```json
// POST /auth/register — request
{ "email": "string", "password": "string", "name": "string" }

// POST /auth/register — response 201
{ "token": "string", "refreshToken": "string", "user": { "id": "uuid", "email": "string", "name": "string" } }

// POST /auth/login — request
{ "email": "string", "password": "string" }

// POST /auth/login — response 200
{ "token": "string", "refreshToken": "string" }

// POST /auth/refresh — request
{ "refreshToken": "string" }

// POST /auth/refresh — response 200
{ "token": "string", "refreshToken": "string" }

// POST /auth/logout — response 200 (requires Authorization header)
{ "message": "Logged out" }
```

---

## Lists <Badge type="tip" text="Implemented" />

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /lists | All lists for authenticated user |
| GET | /lists/:id/items | Paginated items for a specific list |
| POST | /lists | Create list |
| PATCH | /lists/:id | Rename list |
| DELETE | /lists/:id | Delete list and all its items |

```json
// POST /lists — request
{ "name": "string", "location": "string" }   // location optional

// PATCH /lists/:id — request
{ "name": "string", "location": "string" }   // location optional

// PATCH /lists/:id — response 200
{ "id": "uuid", "name": "string", "location": "string | null", "created_at": "timestamp" }

// GET /lists — response 200
[{ "id": "uuid", "name": "string", "location": "string | null", "item_count": 0, "total_value": 0, "created_at": "timestamp" }]

// GET /lists/:id/items — query params
// cursor?: uuid   — ID of the last item seen (omit for first page)
// limit?: number  — page size, 1–100 (default 20)

// GET /lists/:id/items — response 200
{
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "description": "string | null",
      "quantity": 1,
      "user_defined_value": 0,
      "category": { "id": "uuid", "name": "string" } | null,
      "images": [],
      "created_at": "timestamp"
    }
  ],
  "nextCursor": "uuid | null"
}

// GET /lists/:id/items — errors
// 404 — list not found or does not belong to the authenticated user
```

---

## Items <Badge type="tip" text="Implemented" />

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /items?search= | Global item search by name |
| POST | /items | Create item; optional image upload via multipart/form-data |
| PATCH | /items/:id | Update item fields; optional image replacement |
| DELETE | /items/:id | Delete item |

```json
// POST /items — request (multipart/form-data)
// Text fields:
//   list_id: uuid (required)
//   name: string (required)
//   description: string (optional)
//   quantity: number (optional, min 1, default 1)
//   category_id: uuid (optional)
//   user_defined_value: number (optional)
// File fields:
//   image: file (optional — JPEG, PNG, WebP, GIF, max 10 MB)

// POST /items — response 201
{
  "id": "uuid",
  "name": "string",
  "description": "string | null",
  "quantity": 1,
  "user_defined_value": "number | null",
  "category": { "id": "uuid", "name": "string" },  // or null
  "images": [
    { "url": "string", "is_main": true }
  ],  // empty array if no image uploaded
  "created_at": "timestamp"
}

// PATCH /items/:id — request (multipart/form-data, all fields optional)
// Text fields: name, description, quantity, category_id, user_defined_value
// File fields: image (replaces existing main image if provided)

// PATCH /items/:id — response 200
{
  "id": "uuid",
  "name": "string",
  "description": "string | null",
  "quantity": 1,
  "user_defined_value": "number | null",
  "category": { "id": "uuid", "name": "string" },  // or null
  "images": [
    { "url": "string", "is_main": true }
  ],  // empty array if no image exists
  "created_at": "timestamp"
}
```

---

## Categories <Badge type="tip" text="Implemented" />

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /categories | List all categories ordered alphabetically |

```json
// GET /categories — response 200
[{ "id": "uuid", "name": "string" }]
```

> All routes require JWT authentication. Seed categories with `npm run prisma:seed`.

---

## AI <Badge type="tip" text="Implemented" />

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /ai/analyze | Upload image, get AI-extracted item data |

```json
// POST /ai/analyze — request (multipart/form-data)
{ "image": "<file>" }

// POST /ai/analyze — response 200
{
  "name": "string",
  "category": "string | null",
  "category_id": "uuid | null",
  "description": "string",
  "price_min": 0,
  "price_max": 0
}
// category: seeded category name when matched; null when no seeded match exists
// category_id: UUID of the matched seeded category, or null when no seeded match exists
// description: one-paragraph item description in Portuguese (Brazil)
```

---

## Monetization <Badge type="tip" text="Implemented" />

Two tiers: **free** (default on registration) and **premium** (granted by a valid RevenueCat subscription).
Free-tier caps are enforced on creation endpoints and on AI calls:

| Tier | Lists | Items | AI calls / month |
|------|-------|-------|------------------|
| free | `FREE_MAX_LISTS` (default 3) | `FREE_MAX_ITEMS` (default 50) | `FREE_MAX_AI_CALLS_PER_MONTH` (default 10) |
| premium | unlimited | unlimited | unlimited |

When a free-tier user exceeds a cap, the API returns `403`:

```json
// POST /lists, POST /items, POST /ai/analyze — 403 Forbidden
{ "statusCode": 403, "message": "Forbidden", "code": "LIMIT_REACHED", "limit": 3 }
```

Premium-gated endpoints (if any) are declared with `@RequiresTier('premium')` and return `403`:

```json
{ "statusCode": 403, "code": "TIER_REQUIRED", "required_tier": "premium" }
```

### RevenueCat webhook

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /webhooks/revenuecat | Receive subscription lifecycle events from RevenueCat |

- Validates the `Authorization` header against `REVENUECAT_WEBHOOK_SECRET` (401 on mismatch).
- Matches `event.app_user_id` (falls back to `original_app_user_id`) to the platform `user.id`.
- Updates `user.tier` based on event type:
  - `INITIAL_PURCHASE`, `RENEWAL`, `UNCANCELLATION`, `PRODUCT_CHANGE`, `BILLING_ISSUE` → `premium`
  - `EXPIRATION` → `free`
  - `CANCELLATION`, `NON_RENEWING_PURCHASE`, `TRANSFER`, `TEST` → tier unchanged
- **Idempotent**: duplicate events (same `event.id`) return 200 without re-applying the change.
- Returns 200 only after the DB write commits; non-200 triggers RevenueCat's retry schedule (5/10/20/40/80 min).

### Reconciliation on login

`POST /auth/login` calls RevenueCat's `GET /subscribers/:app_user_id` and corrects `user.tier`. This makes the webhook a latency optimization — a permanently-missed delivery is caught on the user's next login.

