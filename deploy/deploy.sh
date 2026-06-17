#!/bin/bash
# Build, push, and deploy Circulari API to Cloud Run.
# Run this for every new release.

set -euo pipefail

# ── Must match setup.sh ──────────────────────────────────────────────────────
PROJECT_ID="circulari"
REGION="southamerica-east1"
SERVICE_NAME="circulari-api"
REGISTRY="circulari-backend"

CLOUDSQL_INSTANCE="circulari-db"
DB_NAME="circulari"
GCS_BUCKET="${PROJECT_ID}-circulari-storage"
# ────────────────────────────────────────────────────────────────────────────

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REGISTRY}/${SERVICE_NAME}"
CLOUDSQL_CONNECTION="${PROJECT_ID}:${REGION}:${CLOUDSQL_INSTANCE}"
CR_SA_EMAIL="circulari-run@${PROJECT_ID}.iam.gserviceaccount.com"

echo "▶ Configuring Docker auth..."
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet

echo "▶ Building and pushing image..."
# The Dockerfile's ARG DATABASE_URL default placeholder is enough for `prisma generate`
# (it doesn't connect to the DB), so no build-arg is needed here.
gcloud builds submit \
  --tag "${IMAGE}:latest" \
  --quiet

echo "▶ Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "${IMAGE}:latest" \
  --region "$REGION" \
  --platform managed \
  --service-account "$CR_SA_EMAIL" \
  --add-cloudsql-instances "$CLOUDSQL_CONNECTION" \
  --min-instances 0 \
  --max-instances 10 \
  --cpu 1 \
  --memory 512Mi \
  --cpu-boost \
  --port 3000 \
  --set-env-vars "^;^NODE_ENV=production;STORAGE_PROVIDER=s3;STORAGE_ENDPOINT=https://storage.googleapis.com;STORAGE_REGION=auto;STORAGE_BUCKET=${GCS_BUCKET};STORAGE_PUBLIC_URL=https://storage.googleapis.com/${GCS_BUCKET};EMAIL_PROVIDER=mock;EMAIL_FROM=no-reply@circulari.ai;JWT_EXPIRES_IN=1h;JWT_REFRESH_EXPIRES_IN=7d" \
  --set-secrets "DATABASE_URL=DATABASE_URL:latest,STORAGE_ACCESS_KEY=STORAGE_ACCESS_KEY:latest,STORAGE_SECRET_KEY=STORAGE_SECRET_KEY:latest,JWT_SECRET=JWT_SECRET:latest,JWT_REFRESH_SECRET=JWT_REFRESH_SECRET:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,REVENUECAT_WEBHOOK_SECRET=REVENUECAT_WEBHOOK_SECRET:latest" \
  --allow-unauthenticated \
  --quiet

echo ""
echo "✅ Deployed!"
gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format="value(status.url)"
