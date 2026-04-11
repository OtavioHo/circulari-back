# Infrastructure <Badge type="danger" text="Not Implemented" />

## MVP Setup

Single VPS running:
- Node.js API (NestJS)
- PostgreSQL
- Nginx (reverse proxy)

Images stored externally on S3 / Cloudflare R2.

## Deploy

```
Docker (API + Postgres) + Nginx
```

Recommended: `docker-compose.yml` with services for `api`, `postgres`, `nginx`.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `OPENAI_API_KEY` | OpenAI API key |
| `STORAGE_PROVIDER` | `s3` or `r2` |
| `STORAGE_BUCKET` | Bucket name |
| `STORAGE_REGION` | AWS region (S3 only) |
| `STORAGE_ENDPOINT` | Custom endpoint (R2 only) |
| `STORAGE_ACCESS_KEY` | Access key ID |
| `STORAGE_SECRET_KEY` | Secret access key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `APPLE_CLIENT_ID` | Apple OAuth client ID |

## Backup

- Daily PostgreSQL dump
- Storage (S3/R2) is natively redundant
