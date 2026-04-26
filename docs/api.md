# API

Base URL: `/api/v1`
Auth: `Authorization: Bearer <jwt>` required on all routes except `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/forgot-password`, `/auth/verify-reset-otp`, `/auth/reset-password`, `/health`, and `/webhooks/revenuecat` (secret-authenticated)

---

## Auth <Badge type="warning" text="In Progress" />

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/register | Email + password registration |
| POST | /auth/login | Returns JWT + refresh token |
| POST | /auth/refresh | Exchange refresh token for new token pair |
| POST | /auth/logout | Invalidate refresh token |
| POST | /auth/forgot-password | Request a 6-digit OTP to reset password |
| POST | /auth/verify-reset-otp | Verify OTP, receive a short-lived reset token |
| POST | /auth/reset-password | Reset password using the reset token |
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

// POST /auth/forgot-password — request (always returns 200: email not found, rate-limited, or email send failure are all silent)
{ "email": "string" }

// POST /auth/forgot-password — response 200
{ "message": "If that email exists, a reset code has been sent." }
// Rate limit: a new OTP cannot be sent while a previous one has more than 1 minute of TTL remaining (enforced atomically). Always 200.

// POST /auth/verify-reset-otp — request
{ "email": "string", "otp": "string (6-digit numeric)" }

// POST /auth/verify-reset-otp — response 200
{ "resetToken": "uuid" }
// 401 on wrong/expired OTP

// POST /auth/reset-password — request
{ "email": "string", "resetToken": "uuid", "newPassword": "string (8+ chars, uppercase, special char)" }

// POST /auth/reset-password — response 200
{ "message": "Password has been reset successfully." }
// 401 on invalid/expired reset token
```

---

## Lists <Badge type="tip" text="Implemented" />

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /lists/colors | All available list colors (ordered) |
| GET | /lists/icons | All available list icons (ordered) |
| GET | /lists/pictures | All available list pictures (ordered) |
| GET | /lists | All lists for authenticated user |
| GET | /lists/:id/items | Paginated items for a specific list |
| POST | /lists | Create list |
| PATCH | /lists/:id | Update list |
| DELETE | /lists/:id | Delete list and all its items |

```json
// GET /lists/colors — response 200
[{ "hex_code": "#rrggbb", "name": "string", "order": 0 }]

// GET /lists/icons — response 200
[{ "slug": "string", "name": "string", "order": 0 }]

// GET /lists/pictures — response 200
[{ "slug": "string", "order": 0 }]

// POST /lists — request
{ "name": "string", "location": "string", "color_id": "#rrggbb", "icon_id": "slug", "picture_id": "slug" }
// location optional; color_id (hex), icon_id (slug), picture_id (slug) required

// PATCH /lists/:id — request
{ "name": "string", "location": "string", "color_id": "#rrggbb", "icon_id": "slug", "picture_id": "slug" }
// location, color_id, icon_id, picture_id all optional

// PATCH /lists/:id — response 200
{ "id": "uuid", "name": "string", "location": "string | null", "color_id": "#rrggbb", "icon_id": "slug", "picture_id": "slug", "created_at": "timestamp" }

// GET /lists — response 200
[{ "id": "uuid", "name": "string", "location": "string | null", "color": { "hex_code": "#rrggbb", "name": "string", "order": 0 }, "icon": { "slug": "string", "name": "string", "order": 0 }, "picture": { "slug": "string", "order": 0 }, "item_count": 0, "total_value": 0, "created_at": "timestamp" }]

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
      "list": { "name": "string", "color": "#rrggbb" },
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
| GET | /items?search=&cursor=&limit= | Global item search by name (cursor-paginated) |
| POST | /items | Create item; optional image upload via multipart/form-data |
| PATCH | /items/:id | Update item fields; optional image replacement |
| DELETE | /items/:id | Delete item |

```json
// GET /items?search=&cursor=&limit= — query params
// search: string (optional, default "")
// cursor: uuid (optional) — id of last item from previous page
// limit:  integer 1–100 (optional, default 15)

// GET /items — response 200
{
  "data": [
    {
      "id": "uuid",
      "name": "string",
      "description": "string | null",
      "quantity": 1,
      "user_defined_value": "number | null",
      "category": { "id": "uuid", "name": "string" },
      "images": [{ "url": "string", "is_main": true }],
      "list": { "name": "string", "color": "#rrggbb" },
      "created_at": "timestamp"
    }
  ],
  "nextCursor": "uuid | null"
}

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
  "list": { "name": "string", "color": "#rrggbb" },
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
  "list": { "name": "string", "color": "#rrggbb" },
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

## Dashboard <Badge type="tip" text="Implemented" />

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /dashboard | Summary stats for the authenticated user |

```json
// GET /dashboard — response 200
{
  "list_count": 2,
  "item_count": 3,
  "total_value": 300
}
// total_value: sum of user_defined_value across all items; nulls treated as 0
```

---

## Plan Usage <Badge type="tip" text="Implemented" />

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /plan | Current user's plan name and usage stats |

```json
// GET /plan — response 200
{
  "plan": "free",
  "lists": { "used": 2, "max": 3 },
  "items": { "used": 30, "max": 50 },
  "aiCalls": { "used": 5, "max": 10 }
}
// For premium users, max is null (unlimited) for all fields
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

