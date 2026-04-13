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
| created_at | timestamp | |

## List

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users |
| name | string | |
| created_at | timestamp | |

## Item

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| list_id | uuid | FK → lists |
| name | string | AI-suggested or user-defined |
| description | string | nullable |
| quantity | integer | default 1 |
| location_id | uuid | FK → locations, nullable |
| user_defined_value | decimal | user override; AI price used if null |
| created_at | timestamp | |

## Location

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → users (per-user isolation) |
| name | string | e.g. "Bedroom", "Box 3" |

## ItemImage

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| item_id | uuid | FK → items |
| url | string | S3/R2 public URL |
