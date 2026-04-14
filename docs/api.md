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
{ "name": "string" }

// PATCH /lists/:id — request
{ "name": "string" }

// PATCH /lists/:id — response 200
{ "id": "uuid", "name": "string", "created_at": "timestamp" }

// GET /lists — response 200
[{ "id": "uuid", "name": "string", "item_count": 0, "total_value": 0, "created_at": "timestamp" }]

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
| POST | /items | Create item with final data (no AI, no image) |
| PATCH | /items/:id | Update item fields |
| DELETE | /items/:id | Delete item |

```json
// POST /items — request (application/json)
{
  "list_id": "uuid",
  "name": "string",
  "description": "string",   // optional
  "quantity": 1,             // optional, min 1
  "location_id": "uuid",     // optional
  "user_defined_value": 0    // optional
}

// POST /items — response 201
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "quantity": 1,
  "user_defined_value": 0,
  "images": [],
  "created_at": "timestamp"
}

// PATCH /items/:id — request (all fields optional)
{
  "name": "string",
  "description": "string",
  "quantity": 1,
  "location_id": "uuid",
  "user_defined_value": 0
}

// PATCH /items/:id — response 200
{
  "id": "uuid",
  "name": "string",
  "description": "string | null",
  "quantity": 1,
  "user_defined_value": "number | null",
  "images": [],
  "created_at": "timestamp"
}
```

---

## AI <Badge type="danger" text="Not Implemented" />

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /ai/analyze | Upload image, get AI-extracted item data |

```json
// POST /ai/analyze — request (multipart/form-data)
{ "image": "<file>" }

// POST /ai/analyze — response 200
{
  "name": "string",
  "category": "string",
  "price_min": 0,
  "price_max": 0
}
```

---

## Locations <Badge type="tip" text="Implemented" />

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /location?search= | Search locations |
| POST | /location | Create location |
| PATCH | /location/:id | Rename location |
| DELETE | /location/:id | Delete location |

```json
// POST /location — request
{ "name": "string" }

// PATCH /location/:id — request
{ "name": "string" }

// PATCH /location/:id — response 200
{ "id": "uuid", "name": "string" }
```
