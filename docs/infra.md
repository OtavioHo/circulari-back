# Infrastructure <Badge type="tip" text="Implemented" />

## Production setup

The backend runs on **Google Cloud Platform** (region `southamerica-east1` / São Paulo):

- **Cloud Run** — the NestJS API (serverless, scale-to-zero)
- **Cloud SQL** — PostgreSQL 16 (`db-f1-micro`)
- **Cloud Storage** — images, via the S3-compatible HMAC API
- **Secret Manager** — all secrets
- **Artifact Registry** — container images

> 📖 For the full deploy/redeploy runbook and how to change any configuration or value, see **[Deployment](./deployment)**.

## Local development

`docker-compose.yml` runs Postgres + MinIO locally for development (see repo root). The app itself runs with `npm run start:dev`.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing access tokens |
| `JWT_EXPIRES_IN` | Access token expiry (default: `15m`) |
| `JWT_REFRESH_SECRET` | Secret for signing refresh tokens |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token expiry (default: `7d`) |
| `OPENAI_API_KEY` | OpenAI API key |
| `STORAGE_PROVIDER` | `s3`, `r2`, or `minio` |
| `STORAGE_BUCKET` | Bucket name |
| `STORAGE_REGION` | AWS region (S3); optional for R2/MinIO |
| `STORAGE_ENDPOINT` | Custom endpoint URL (required for R2 + MinIO) |
| `STORAGE_ACCESS_KEY` | Access key ID |
| `STORAGE_SECRET_KEY` | Secret access key |
| `STORAGE_PUBLIC_URL` | Base URL for public links (optional; defaults vary by provider) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `APPLE_CLIENT_ID` | Apple OAuth client ID |
| `REVENUECAT_WEBHOOK_SECRET` | Shared secret for validating incoming RevenueCat webhooks (required in prod) |
| `REVENUECAT_API_KEY` | REST secret key for reconciling subscription state on login (optional; reconciliation is skipped if unset) |
| `REVENUECAT_API_URL` | Override for the RevenueCat REST base URL (default `https://api.revenuecat.com/v1`) |
| `FREE_MAX_LISTS` | Free-tier cap on total lists per user (default 3) |
| `FREE_MAX_ITEMS` | Free-tier cap on total items per user (default 50) |
| `FREE_MAX_AI_CALLS_PER_MONTH` | Free-tier cap on `/ai/analyze` calls per calendar month (default 10) |
| `EMAIL_PROVIDER` | Email transport: `stalwart` or `mock` |
| `EMAIL_FROM` | Sender address (e.g. `no-reply@example.com`) |
| `STALWART_SMTP_HOST` | SMTP hostname for Stalwart provider |
| `STALWART_SMTP_PORT` | SMTP port (typically `587`; required for Stalwart provider) |
| `STALWART_SMTP_USER` | SMTP username |
| `STALWART_SMTP_PASS` | SMTP password |

## Backup

- Daily PostgreSQL dump
- Storage (S3/R2) is natively redundant
