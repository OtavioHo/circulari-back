# Monetization <Badge type="tip" text="Implemented" />

## Overview

Two subscription tiers control what users can do:

| Tier | Lists | Items | AI calls / month |
|------|-------|-------|------------------|
| `free` | `FREE_MAX_LISTS` (default 3) | `FREE_MAX_ITEMS` (default 50) | `FREE_MAX_AI_CALLS_PER_MONTH` (default 10) |
| `premium` | unlimited | unlimited | unlimited |

Every new account starts as `free`. The `users.tier` field is updated to `premium` (or back to `free`) by RevenueCat webhooks and verified on each login via the RevenueCat REST API.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `REVENUECAT_WEBHOOK_SECRET` | **Yes (prod)** | Shared secret that RevenueCat sends in `Authorization: Bearer <secret>`. Used to authenticate every incoming webhook. |
| `REVENUECAT_API_KEY` | Recommended | RevenueCat REST secret key. Used on login to reconcile subscription state. Reconciliation is silently skipped if unset. |
| `REVENUECAT_API_URL` | No | Override the RevenueCat REST base URL. Defaults to `https://api.revenuecat.com/v1`. Useful for testing with a mock server. |
| `FREE_MAX_LISTS` | No | Cap on lists per free user. Default `3`. |
| `FREE_MAX_ITEMS` | No | Cap on items per free user (across all lists). Default `50`. |
| `FREE_MAX_AI_CALLS_PER_MONTH` | No | Cap on `/ai/analyze` calls per calendar month. Default `10`. |

Set lower values in development (e.g. `FREE_MAX_LISTS=2`) to exercise caps without creating many records.

---

## RevenueCat Setup

### 1. Create a RevenueCat Project

1. Sign up at [app.revenuecat.com](https://app.revenuecat.com).
2. Create a new **Project** and give it a name (e.g. `Circulari`).
3. Under **API Keys**, copy the **Secret key (sk_…)** — this goes in `REVENUECAT_API_KEY`.

### 2. Connect the Apple App Store

> Complete this before creating products in RevenueCat.

**In App Store Connect:**

1. Go to **Users and Access → Keys → App Store Connect API**.
2. Generate a key with **Developer** role. Download the `.p8` file and note the **Key ID** and **Issuer ID**.
3. Under your app → **Subscriptions**, create a **Subscription Group** (e.g. `Premium`).
4. Inside that group, create a subscription product:
   - **Product ID**: e.g. `com.circulari.premium.monthly`
   - Set pricing, duration (1 month), and localisations.
   - Submit for review (or use sandbox while developing).

**In RevenueCat:**

1. Open your project → **App Settings → Apple App Store**.
2. Enter your **Bundle ID**, **App Store Connect API Key** (`.p8` content), **Key ID**, and **Issuer ID**.
3. RevenueCat will import your products automatically.

### 3. Connect the Google Play Store

> Requires a published (at least internal-track) app in Google Play Console.

**In Google Play Console:**

1. Go to **Monetize → Products → Subscriptions**.
2. Create a subscription:
   - **Product ID**: e.g. `com.circulari.premium.monthly`
   - Set billing period and price.
3. Under **Setup → API access**, link the app to a Google Cloud project and enable the **Google Play Android Developer API**.
4. Create a **Service Account** in Google Cloud with **Pub/Sub Admin** and **Monitoring Viewer** roles, and download the JSON key.

**In RevenueCat:**

1. Open your project → **App Settings → Google Play Store**.
2. Enter your **Package Name** and upload the **Service Account JSON** key.

### 4. Define Products and Entitlements

1. In RevenueCat, go to **Products** and create a product for each app store product ID (e.g. `com.circulari.premium.monthly`).
2. Go to **Entitlements** and create one called **`premium`**.
3. Attach all premium products to the `premium` entitlement.
4. Go to **Offerings** and create a default offering that exposes those products to the mobile app.

> The backend only cares whether a user has an active `premium` entitlement. The offering/products structure is for the mobile client's paywall UI.

### 5. Configure the Webhook

1. In RevenueCat, go to **Project Settings → Integrations → Webhooks**.
2. Add a new webhook:
   - **URL**: `https://your-api.com/api/v1/webhooks/revenuecat`
   - **Authorization header value**: pick a strong random string (e.g. `openssl rand -base64 32`). This exact string goes in `REVENUECAT_WEBHOOK_SECRET`.
3. Enable all event types (the backend maps each type to a tier action — unknown types are safely ignored).
4. Use **Send test notification** to verify the backend receives and accepts the request.

### 6. Set the App User ID

RevenueCat's `app_user_id` must equal the Circulari `user.id` (UUID). Configure this in the mobile app when initialising the RevenueCat SDK:

```dart
// Flutter — call after login
await Purchases.logIn(currentUser.id);
```

This ensures webhooks reference the correct backend user. If you use anonymous IDs before login, call `logIn` to transfer the subscription to the authenticated user.

---

## How the Backend Handles Subscriptions

### Webhook flow

```
RevenueCat → POST /api/v1/webhooks/revenuecat
  1. verifySignature — compares Authorization header to REVENUECAT_WEBHOOK_SECRET (timing-safe)
  2. processEvent   — inserts event_id into processed_webhook_events (dedup)
  3. updateUserTier — sets users.tier based on event.type:
       INITIAL_PURCHASE, RENEWAL, UNCANCELLATION,
       PRODUCT_CHANGE, BILLING_ISSUE → "premium"
       EXPIRATION                    → "free"
       CANCELLATION, NON_RENEWING_PURCHASE,
       TRANSFER, TEST                → no change (ignored)
```

Duplicate webhook deliveries (same `event.id`) return 200 without re-applying the tier change. Non-200 responses cause RevenueCat to retry on a 5 / 10 / 20 / 40 / 80 min back-off.

### Login reconciliation

On every `POST /auth/login`, the backend calls `GET /subscribers/:userId` on the RevenueCat REST API (fire-and-forget, 5 s timeout). If the subscriber has an active entitlement, `users.tier` is set to `premium`; otherwise `free`. This catches any webhook that was permanently missed.

Reconciliation is skipped silently if `REVENUECAT_API_KEY` is not set — safe for local development.

### Limit enforcement

| Endpoint | Guard |
|----------|-------|
| `POST /lists` | `withListCapLock` — advisory lock + count check inside a transaction |
| `POST /items` | `withItemCapLock` — advisory lock + count check inside a transaction |
| `POST /ai/analyze` | `reserveAiCall` — atomic upsert with a conditional WHERE clause |

When a cap is exceeded, any guarded endpoint returns:

```json
{ "statusCode": 403, "message": "Forbidden", "code": "LIMIT_REACHED", "limit": 3 }
```

The `limit` value reflects the user's current tier cap (always `Infinity` for premium, so the check is skipped entirely).

---

## Testing Locally

### Lower the caps

In `.env`:

```env
FREE_MAX_LISTS=2
FREE_MAX_ITEMS=3
FREE_MAX_AI_CALLS_PER_MONTH=2
```

Restart the dev server after changing these (NestJS reads them at boot via `ConfigService`).

### Simulate a webhook

```bash
curl -X POST http://localhost:3000/api/v1/webhooks/revenuecat \
  -H "Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "id": "evt-test-001",
      "type": "INITIAL_PURCHASE",
      "app_user_id": "<USER_UUID>"
    }
  }'
# → 200 {"received":true}  user.tier is now "premium"
```

Repeat with `"type": "EXPIRATION"` to flip back to `free`. Re-sending the same `event.id` returns 200 with no DB write (idempotency).

### Seed the AI usage counter

```bash
# Set call_count to the cap to trigger LIMIT_REACHED on the next call
psql $DATABASE_URL -c "
  INSERT INTO ai_usages (id, user_id, month, call_count)
  VALUES (gen_random_uuid()::text, '<USER_UUID>', '$(date -u +%Y-%m)', 2)
  ON CONFLICT (user_id, month) DO UPDATE SET call_count = 2;
"
```

### Verify plan usage via API

```bash
curl http://localhost:3000/api/v1/plan \
  -H "Authorization: Bearer <JWT>"
# → 200 { "plan": "free", "lists": { "used": 1, "max": 3 }, "items": { "used": 5, "max": 50 }, "aiCalls": { "used": 2, "max": 10 } }
```

After upgrading to premium via webhook, `max` values become `null` for all fields.

### Test a wrong webhook secret

```bash
curl -X POST http://localhost:3000/api/v1/webhooks/revenuecat \
  -H "Authorization: Bearer wrong-secret" \
  -H "Content-Type: application/json" \
  -d '{"event":{"id":"x","type":"TEST","app_user_id":"y"}}'
# → 401 Unauthorized
```

---

## Production Checklist

- [ ] `REVENUECAT_WEBHOOK_SECRET` set to a cryptographically random value (`openssl rand -base64 32`)
- [ ] `REVENUECAT_API_KEY` set to the RevenueCat secret key (enables login reconciliation)
- [ ] Webhook URL registered in RevenueCat dashboard, pointing to the production API
- [ ] Apple subscription product created and approved in App Store Connect
- [ ] Google subscription product created and activated in Google Play Console
- [ ] RevenueCat entitlement `premium` has both Apple and Google products attached
- [ ] Mobile app calls `Purchases.logIn(user.id)` after authentication
- [ ] RevenueCat **Send test notification** returns 200 from the production endpoint
- [ ] Free-tier cap env vars reviewed and set to intended values (defaults: lists 3, items 50, AI calls 10)
