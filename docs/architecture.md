# Architecture

## Stack

| Layer | Technology |
|-------|-----------|
| Mobile | Flutter + Bloc (state management) |
| Backend | Node.js + NestJS, REST API |
| Database | PostgreSQL |
| Storage | S3-compatible (AWS S3 or Cloudflare R2) |
| AI | OpenAI API (GPT-4o or GPT-4o-mini) |
| Deploy | Docker + Nginx on VPS |

## Data Flow

```
Flutter App
  └─► REST API (NestJS)
        ├─► PostgreSQL
        ├─► S3 / Cloudflare R2  (images)
        └─► OpenAI API          (image analysis)
```

## Backend Layers

```
Controller → Service → Repository
```

No layer skipping. Controllers handle HTTP, Services hold business logic, Repositories handle DB access.

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| Single-tenant MVP | No collaboration; each user has fully isolated data |
| Synchronous AI | Item creation waits for OpenAI — simpler flow, accepted latency tradeoff |
| Storage abstraction | S3-compatible interface allows swapping AWS S3 ↔ Cloudflare R2 without code changes |
| JWT stateless auth | No server-side sessions; scales horizontally |
| Social login (Google + Apple) | Required for App Store / Play Store approval |
