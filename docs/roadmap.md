# Roadmap

## Milestone 1 — Auth + Backend Structure <Badge type="warning" text="In Progress" />

- [x] NestJS project setup
- [x] PostgreSQL connection + migrations
- [x] `POST /auth/register`
- [x] `POST /auth/login`
- [ ] `POST /auth/social` (Google + Apple)
- [x] JWT middleware

## Milestone 2 — Lists + Items CRUD <Badge type="tip" text="Implemented" />

- [x] Lists endpoints (GET, POST, PATCH, DELETE)
- [x] Items endpoints (GET, POST, PATCH, DELETE)
- [x] Refactor location from separate entity to plain `location` string on List
- [x] Global item search (`GET /items?search=`)
- [x] Paginated items by list (`GET /lists/:id/items` — cursor-based)
- [x] Category reference table with seeded Portuguese values; `category_id` on items
- [x] List color and icon selection (`GET /lists/colors`, `GET /lists/icons`; `color_id`/`icon_id` on lists)
- [x] List picture selection (`GET /lists/pictures`; `picture_id` on lists; slug-based, 4 seeded presets)

## Milestone 3 — Image Upload + Storage <Badge type="tip" text="Implemented" />

- [x] S3-compatible storage abstraction
- [x] Image upload to S3/R2 on `POST /items`
- [x] `ItemImage` DB record created with returned URL

## Milestone 4 — AI Integration <Badge type="tip" text="Implemented" />

- [x] `POST /ai/analyze` endpoint
- [x] OpenAI Vision API call
- [x] Price normalization layer
- [x] Return suggestions to client (`name`, `category`, `price_min`, `price_max`)
- [x] Error response when AI fails (client falls back to manual entry)

## Milestone 5 — Dashboard + Search <Badge type="tip" text="Implemented" />

- [x] Per-list total value calculation
- [x] Global total value
- [x] Dashboard endpoint (list count, item count, total value)
- [x] Full-text search on item names

## Milestone 6 — Monetization <Badge type="warning" text="In Progress" />

- [x] Free tier limits (items/lists cap, AI call cap)
- [x] Paid tier unlock
- [x] Payment integration (RevenueCat webhook + login reconciliation)
- [ ] Export feature (paid)
