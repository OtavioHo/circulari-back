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
| POST | /lists | Create list |
| PATCH | /lists/:id | Rename list |
| DELETE | /lists/:id | Delete list and all its items |

```json
// POST /lists — request
{ "name": "string" }

// GET /lists — response 200
[{ "id": "uuid", "name": "string", "item_count": 0, "total_value": 0, "created_at": "timestamp" }]
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

## Locations <Badge type="danger" text="Not Implemented" />

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /location?search= | Search locations |
| POST | /location | Create location |
| PATCH | /location/:id | Rename location |
| DELETE | /location/:id | Delete location |

```json
// POST /location — request
{ "name": "string" }
```
