# API

Base URL: `/api/v1`
Auth: `Authorization: Bearer <jwt>` required on all routes except `/auth/register`, `/auth/login`, `/auth/refresh`, and `/health`

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

> **Categories** are read-only reference data. No `GET /categories` endpoint is exposed — seed the DB with `npm run prisma:seed` to populate them. Use a seeded category's `id` as `category_id` in item requests.

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

