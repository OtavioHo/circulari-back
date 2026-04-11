# Roadmap

## Milestone 1 — Auth + Backend Structure <Badge type="warning" text="In Progress" />

- [x] NestJS project setup
- [ ] PostgreSQL connection + migrations
- [ ] `POST /auth/register`
- [ ] `POST /auth/login`
- [ ] `POST /auth/social` (Google + Apple)
- [ ] JWT middleware

## Milestone 2 — Lists + Items CRUD <Badge type="danger" text="Not Implemented" />

- [ ] Lists endpoints (GET, POST, PATCH, DELETE)
- [ ] Items endpoints (GET, POST, PATCH, DELETE)
- [ ] Locations endpoints
- [ ] Global item search (`GET /items?search=`)

## Milestone 3 — Image Upload + Storage <Badge type="danger" text="Not Implemented" />

- [ ] S3-compatible storage abstraction
- [ ] Image upload to S3/R2 on `POST /items`
- [ ] `ItemImage` DB record created with returned URL

## Milestone 4 — AI Integration <Badge type="danger" text="Not Implemented" />

- [ ] `POST /ai/analyze` endpoint
- [ ] OpenAI Vision API call
- [ ] Price normalization layer
- [ ] Return suggestions + `image_url` to client
- [ ] Error response when AI fails (client falls back to manual entry)

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
