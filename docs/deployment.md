# Deployment (GCP Cloud Run) <Badge type="tip" text="Implemented" />

Operational runbook for deploying and configuring the Circulari backend on Google Cloud Platform.

The API runs on **Cloud Run** (serverless, scale-to-zero) in the **São Paulo** region, backed by **Cloud SQL** (PostgreSQL) and **Cloud Storage** (S3-compatible, via HMAC keys). All secrets live in **Secret Manager**; the container image lives in **Artifact Registry**.

> **Production URL:** `https://circulari-api-315918890342.southamerica-east1.run.app`
> All routes are under the global prefix **`/api/v1`** (e.g. `/api/v1/health`).

## Architecture at a glance

| Layer | GCP Service | Resource |
|-------|-------------|----------|
| API | Cloud Run | `circulari-api` (region `southamerica-east1`) |
| Database | Cloud SQL (PostgreSQL 16) | `circulari-db` (`db-f1-micro`, Enterprise edition) |
| Object storage | Cloud Storage | bucket `circulari-circulari-storage` |
| Image registry | Artifact Registry | `circulari-backend` |
| Secrets | Secret Manager | see [Secrets reference](#secrets-reference) |
| Runtime identity | Service Account | `circulari-run@circulari.iam.gserviceaccount.com` |
| Storage identity | Service Account + HMAC | `circulari-storage@circulari.iam.gserviceaccount.com` |

- **Project ID:** `circulari`
- **Region:** `southamerica-east1` (São Paulo)
- **Cloud SQL connection name:** `circulari:southamerica-east1:circulari-db`
- Cloud Run reaches Cloud SQL over a **Unix socket** (`?host=/cloudsql/<connection-name>`), not a public IP.

## The two scripts

Everything lives in [`back/deploy/`](https://github.com/) and is the **source of truth** for configuration:

| Script | When to run | What it does |
|--------|-------------|--------------|
| `deploy/setup.sh` | **Once**, on a fresh project | Creates all infra: Cloud SQL, bucket, registry, service accounts, base secrets, IAM |
| `deploy/deploy.sh` | **Every release** | Builds the image (Cloud Build), pushes to Artifact Registry, deploys a new Cloud Run revision |

> ⚠️ **Golden rule:** any permanent config change must be reflected in `deploy.sh` (or the secret in Secret Manager). If you only change something live via the console / an ad-hoc `gcloud` command, the next `deploy.sh` run will revert it.

## Prerequisites

```bash
# Install the gcloud CLI (macOS)
brew install --cask google-cloud-cli

# Authenticate (once per machine)
gcloud init
gcloud auth login
gcloud auth application-default login
gcloud auth application-default set-quota-project circulari
```

## First-time setup (new environment only)

Already done for the `circulari` project — only needed when bootstrapping a brand-new GCP project.

1. Edit `deploy/setup.sh` and set `PROJECT_ID` and a strong `DB_PASSWORD`.
2. Run it:
   ```bash
   bash deploy/setup.sh
   ```
3. Add the secrets that `setup.sh` cannot generate (see [Adding a new secret](#adding-a-new-secret)).

`setup.sh` is idempotent — existing resources are skipped.

## Redeploying a new version

This is the normal day-to-day flow. After merging code changes:

```bash
bash deploy/deploy.sh
```

This will:
1. Build the Docker image via **Cloud Build** (~3 min).
2. Push it to Artifact Registry as `:latest`.
3. Deploy a new Cloud Run revision and route 100% of traffic to it.
4. Print the service URL.

**Migrations run automatically.** The container's `entrypoint.sh` runs `npx prisma migrate deploy` on every boot, before starting the app. New migrations are applied as part of the deploy; if none are pending it's a no-op.

## Changing configuration & values

Config lives in two places depending on sensitivity:

- **Non-secret env vars** → in `deploy.sh` (the `--set-env-vars` line)
- **Secret values** → in Secret Manager (referenced by `name:latest` in `deploy.sh`)

### Change a non-secret env var

Examples: `EMAIL_PROVIDER`, `STORAGE_BUCKET`, `JWT_EXPIRES_IN`, `NODE_ENV`.

**Permanent (recommended):** edit the `--set-env-vars` value in `deploy.sh`, then redeploy:
```bash
# edit deploy.sh, then:
bash deploy/deploy.sh
```

**Quick / temporary (no rebuild):** creates a new revision on the current image:
```bash
gcloud run services update circulari-api --region=southamerica-east1 \
  --update-env-vars EMAIL_PROVIDER=stalwart
```
> A live `--update-env-vars` that isn't also written into `deploy.sh` will be lost on the next `deploy.sh` run.

### Change the value of an existing secret

Examples: rotate `OPENAI_API_KEY`, change `JWT_SECRET`, update `DATABASE_URL`.

1. Add a **new version** of the secret (the old version stays for rollback):
   ```bash
   echo -n "new-value" | gcloud secrets versions add OPENAI_API_KEY --data-file=-
   ```
2. The running service keeps the old value until a new revision is created. Pick up `:latest` with either:
   ```bash
   bash deploy/deploy.sh                                   # full rebuild + deploy
   # OR, no rebuild — just roll a new revision:
   gcloud run services update circulari-api --region=southamerica-east1
   ```

> Never `echo` a secret value into the terminal in a way that gets logged. Prefer piping from a file or `printf '%s'`.

### Add a new secret

Example: enabling real email by adding the `STALWART_SMTP_*` secrets.

```bash
# 1. Create the secret
echo -n "smtp.example.com" | gcloud secrets create STALWART_SMTP_HOST --data-file=-

# 2. Grant the Cloud Run SA access (project-level binding already covers
#    secretAccessor, so this is usually automatic; verify if needed)

# 3. Reference it in deploy.sh, inside the --set-secrets list:
#    STALWART_SMTP_HOST=STALWART_SMTP_HOST:latest

# 4. Redeploy
bash deploy/deploy.sh
```

### Enable real email (switch off `mock`)

The deploy currently runs `EMAIL_PROVIDER=mock` — **no emails are actually sent** (password reset, etc.). To enable Stalwart SMTP:

1. Create the secrets `STALWART_SMTP_HOST`, `STALWART_SMTP_PORT`, `STALWART_SMTP_USER`, `STALWART_SMTP_PASS` (see above).
2. In `deploy.sh`: change `EMAIL_PROVIDER=mock` → `EMAIL_PROVIDER=stalwart` and add the four secrets to `--set-secrets`.
3. `bash deploy/deploy.sh`.

### Scaling & cold start

The service runs `--min-instances 0` (scales to zero, ~\$0 when idle, but the first request after idle has a ~2–4s cold start).

| Goal | Command |
|------|---------|
| Kill cold start (keep 1 warm, ~\$8/mo) | edit `deploy.sh` → `--min-instances 1`, redeploy. Or live: `gcloud run services update circulari-api --region=southamerica-east1 --min-instances=1` |
| Raise max concurrency headroom | `--max-instances <N>` |
| More CPU / RAM | `--cpu <N> --memory <Mi>` |

## Common operations

```bash
# Tail / read recent logs
gcloud run services logs read circulari-api --region=southamerica-east1 --limit=50

# Describe the service (URL, revision, config)
gcloud run services describe circulari-api --region=southamerica-east1

# List revisions
gcloud run revisions list --service=circulari-api --region=southamerica-east1

# Roll back to a previous revision (instant, no rebuild)
gcloud run services update-traffic circulari-api --region=southamerica-east1 \
  --to-revisions=<REVISION_NAME>=100

# Health check
curl https://circulari-api-315918890342.southamerica-east1.run.app/api/v1/health
# -> {"status":"ok","info":{"database":{"status":"up"}}}
```

## Secrets reference

Stored in Secret Manager, injected into Cloud Run as env vars via `--set-secrets` in `deploy.sh`.

| Secret | Purpose |
|--------|---------|
| `DATABASE_URL` | Cloud SQL connection string (Unix socket) |
| `JWT_SECRET` | Signs access tokens |
| `JWT_REFRESH_SECRET` | Signs refresh tokens |
| `OPENAI_API_KEY` | OpenAI (image analysis) |
| `REVENUECAT_WEBHOOK_SECRET` | Validates RevenueCat webhooks |
| `STORAGE_ACCESS_KEY` | GCS HMAC access key (S3-compatible) |
| `STORAGE_SECRET_KEY` | GCS HMAC secret key |

Secrets **not yet set** (only needed when enabling those features): `STALWART_SMTP_*` (real email), `REVENUECAT_API_KEY` (subscription reconciliation), `GOOGLE_CLIENT_ID` / `APPLE_CLIENT_ID` (social login).

## Non-secret env vars reference

Set directly in `deploy.sh` (`--set-env-vars`).

| Variable | Current value | Notes |
|----------|---------------|-------|
| `NODE_ENV` | `production` | |
| `STORAGE_PROVIDER` | `s3` | GCS via S3-compatible API |
| `STORAGE_ENDPOINT` | `https://storage.googleapis.com` | |
| `STORAGE_REGION` | `auto` | |
| `STORAGE_BUCKET` | `circulari-circulari-storage` | |
| `STORAGE_PUBLIC_URL` | `https://storage.googleapis.com/circulari-circulari-storage` | |
| `EMAIL_PROVIDER` | `mock` | switch to `stalwart` for real email |
| `EMAIL_FROM` | `no-reply@circulari.ai` | |
| `JWT_EXPIRES_IN` | `1h` | |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | |
| `PORT` | (set by Cloud Run) | app reads `process.env.PORT`, defaults to 3000 |

> See [Infrastructure](./infra) for the full list of variables the app supports.

## Troubleshooting / gotchas

- **`Invalid Tier (db-f1-micro) for (ENTERPRISE_PLUS)`** — shared-core tiers (`db-f1-micro`, `db-g1-small`) require the **Enterprise** edition. `setup.sh` passes `--edition=ENTERPRISE`. Without it, GCP defaults to Enterprise Plus and rejects the tier.
- **Silent setup failures** — early versions of `setup.sh` used `... 2>/dev/null || echo "already exists"`, which masked *any* error (not just "already exists"). If a resource seems missing after setup, verify it explicitly with `gcloud sql instances describe …`, `gcloud secrets list`, etc.
- **404 on every route** — the app mounts everything under `/api/v1`. Hitting `/health` returns 404; the correct path is `/api/v1/health`.
- **401 on a route** — expected for protected endpoints without a valid JWT. A `500` (not `401`) would indicate a missing `JWT_SECRET`.
- **Secret value change not taking effect** — adding a secret version does **not** restart the service. You must roll a new revision (`deploy.sh` or `gcloud run services update`).
- **`db-f1-micro` and Prisma** — 0.6 GB RAM is tight; under load consider upgrading to `db-g1-small` (1.7 GB). The tier is set in `setup.sh` and can be changed live with `gcloud sql instances patch circulari-db --tier=db-g1-small`.

## Cost

Scale-to-zero Cloud Run + `db-f1-micro` ≈ **\$14–18/mo** at low traffic. See [Infrastructure Costs](./infrastructure-costs) for the full breakdown and tier comparison.
