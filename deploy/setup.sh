#!/bin/bash
# One-time GCP infrastructure setup for Circulari backend.
# Run this once before your first deploy.
#
# Prerequisites:
#   gcloud auth login
#   gcloud auth application-default login

set -euo pipefail

# ── Configure these before running ──────────────────────────────────────────
PROJECT_ID="circulari"
REGION="southamerica-east1"
SERVICE_NAME="circulari-api"
REGISTRY="circulari-backend"

CLOUDSQL_INSTANCE="circulari-db"
DB_NAME="circulari"
DB_USER="circulari"
DB_PASSWORD=""          # fill in a strong password before running (do not commit a real value)

GCS_BUCKET="${PROJECT_ID}-circulari-storage"
# ────────────────────────────────────────────────────────────────────────────

if [[ -z "$DB_PASSWORD" ]]; then
  echo "ERROR: set DB_PASSWORD before running this script."
  exit 1
fi

echo "▶ Setting project..."
gcloud config set project "$PROJECT_ID"

echo "▶ Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  cloudbuild.googleapis.com

# ── Artifact Registry ────────────────────────────────────────────────────────
echo "▶ Creating Artifact Registry repository..."
gcloud artifacts repositories create "$REGISTRY" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Circulari backend images" \
  --quiet 2>/dev/null || echo "  (already exists, skipping)"

# ── Cloud SQL ────────────────────────────────────────────────────────────────
echo "▶ Creating Cloud SQL instance (db-f1-micro, PostgreSQL 16)..."
echo "  This can take 5-10 minutes..."
gcloud sql instances create "$CLOUDSQL_INSTANCE" \
  --database-version=POSTGRES_16 \
  --edition=ENTERPRISE \
  --tier=db-f1-micro \
  --region="$REGION" \
  --storage-type=SSD \
  --storage-size=10GB \
  --no-backup \
  --quiet 2>/dev/null || echo "  (already exists, skipping)"

echo "▶ Creating database and user..."
gcloud sql databases create "$DB_NAME" \
  --instance="$CLOUDSQL_INSTANCE" --quiet 2>/dev/null || echo "  (already exists)"

gcloud sql users create "$DB_USER" \
  --instance="$CLOUDSQL_INSTANCE" \
  --password="$DB_PASSWORD" \
  --quiet 2>/dev/null || echo "  (already exists)"

CLOUDSQL_CONNECTION="${PROJECT_ID}:${REGION}:${CLOUDSQL_INSTANCE}"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost/${DB_NAME}?host=/cloudsql/${CLOUDSQL_CONNECTION}"

# ── GCS Bucket ───────────────────────────────────────────────────────────────
echo "▶ Creating GCS bucket..."
gcloud storage buckets create "gs://${GCS_BUCKET}" \
  --location="$REGION" \
  --uniform-bucket-level-access \
  --quiet 2>/dev/null || echo "  (already exists, skipping)"

# Generate HMAC keys for S3-compatible access
echo "▶ Creating service account for storage..."
SA_NAME="circulari-storage"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts create "$SA_NAME" \
  --display-name="Circulari Storage SA" \
  --quiet 2>/dev/null || echo "  (already exists)"

gcloud storage buckets add-iam-policy-binding "gs://${GCS_BUCKET}" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/storage.objectAdmin" --quiet

HMAC_OUTPUT=$(gcloud storage hmac create "$SA_EMAIL" --project="$PROJECT_ID" --format=json 2>/dev/null || echo "")
if [[ -n "$HMAC_OUTPUT" ]]; then
  HMAC_ACCESS=$(echo "$HMAC_OUTPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['metadata']['accessId'])" 2>/dev/null || echo "see console")
  HMAC_SECRET=$(echo "$HMAC_OUTPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['secret'])" 2>/dev/null || echo "see console")
else
  echo "  HMAC key may already exist. Create manually: gcloud storage hmac create ${SA_EMAIL}"
  HMAC_ACCESS="REPLACE_ME"
  HMAC_SECRET="REPLACE_ME"
fi

# ── Secret Manager ───────────────────────────────────────────────────────────
echo "▶ Creating secrets in Secret Manager..."

create_secret() {
  local name="$1"
  local value="$2"
  echo -n "$value" | gcloud secrets create "$name" \
    --data-file=- --replication-policy=automatic --quiet 2>/dev/null \
    || echo -n "$value" | gcloud secrets versions add "$name" --data-file=- --quiet
}

create_secret "DATABASE_URL" "$DATABASE_URL"
create_secret "STORAGE_ACCESS_KEY" "$HMAC_ACCESS"
create_secret "STORAGE_SECRET_KEY" "$HMAC_SECRET"

echo ""
echo "  ⚠  Add remaining secrets manually (OpenAI, RevenueCat, SMTP, etc.):"
echo "     gcloud secrets create SECRET_NAME --data-file=- <<< 'value'"
echo "     Secrets to add: OPENAI_API_KEY, REVENUECAT_WEBHOOK_SECRET, REVENUECAT_API_KEY,"
echo "                     EMAIL_FROM, STALWART_SMTP_HOST, STALWART_SMTP_PORT,"
echo "                     STALWART_SMTP_USER, STALWART_SMTP_PASS"

# ── Cloud Run service account ────────────────────────────────────────────────
echo "▶ Creating Cloud Run service account..."
CR_SA_NAME="circulari-run"
CR_SA_EMAIL="${CR_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

gcloud iam service-accounts create "$CR_SA_NAME" \
  --display-name="Circulari Cloud Run SA" --quiet 2>/dev/null || echo "  (already exists)"

# Allow it to access Cloud SQL and Secret Manager
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CR_SA_EMAIL}" \
  --role="roles/cloudsql.client" --quiet

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${CR_SA_EMAIL}" \
  --role="roles/secretmanager.secretAccessor" --quiet

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "✅ Infrastructure ready!"
echo ""
echo "   Cloud SQL connection : $CLOUDSQL_CONNECTION"
echo "   GCS bucket           : gs://${GCS_BUCKET}"
echo "   Image registry       : ${REGION}-docker.pkg.dev/${PROJECT_ID}/${REGISTRY}/${SERVICE_NAME}"
echo "   Cloud Run SA         : ${CR_SA_EMAIL}"
echo ""
echo "Next: run deploy/deploy.sh"
