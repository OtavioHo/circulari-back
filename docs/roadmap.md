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
- [x] Locations endpoints
- [x] Global item search (`GET /items?search=`)
- [x] Paginated items by list (`GET /lists/:id/items` — cursor-based)

## Milestone 3 — Image Upload + Storage <Badge type="warning" text="In Progress" />

- [x] S3-compatible storage abstraction
- [ ] Image upload to S3/R2 on `POST /items`
- [ ] `ItemImage` DB record created with returned URL

## Milestone 4 — AI Integration <Badge type="tip" text="Implemented" />

- [x] `POST /ai/analyze` endpoint
- [x] OpenAI Vision API call
- [x] Price normalization layer
- [x] Return suggestions to client (`name`, `category`, `price_min`, `price_max`)
- [x] Error response when AI fails (client falls back to manual entry)

## Milestone 5 — Dashboard + Search <Badge type="danger" text="Not Implemented" />

- [ ] Per-list total value calculation
- [ ] Global total value
- [ ] Dashboard endpoint (list count, item count, total value)
- [ ] Full-text search on item names

## Milestone 6 — Monetization <Badge type="danger" text="Not Implemented" />

- [ ] Free tier limits (items/lists cap, AI call cap)
- [ ] Paid tier unlock
- [ ] Payment integration
- [ ] Export feature (paid)
