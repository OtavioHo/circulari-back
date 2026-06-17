# Monetization <Badge type="tip" text="Implemented" />

## Overview

Three subscription tiers control what users can do:

| Tier | Price | Lists | Items | AI calls / month |
|------|-------|-------|-------|------------------|
| 🟢 `free` | grátis | `FREE_MAX_LISTS` (default **1**) | `FREE_MAX_ITEMS` (default 50) | `FREE_MAX_AI_CALLS_PER_MONTH` (default 10) |
| 🔵 `essencial` | R$ 19,90/mês | `ESSENCIAL_MAX_LISTS` (default 3) | `ESSENCIAL_MAX_ITEMS` (default 70) | unlimited |
| 🟣 `pro` | R$ 49,90/mês | `PRO_MAX_LISTS` (default 5) | `PRO_MAX_ITEMS` (default 150) | unlimited |

Every new account starts as `free`. The `users.tier` field is updated by RevenueCat webhooks,
verified on each login via the RevenueCat REST API, and can be reconciled on demand
(`POST /plan/reconcile`) right after a purchase. The tier is derived from **which entitlement**
is active — `pro` outranks `essencial` when both are present.

> Legacy note: there are no `premium` users, but a stray `premium` tier value is aliased to
> `pro` defensively across the backend.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `REVENUECAT_WEBHOOK_SECRET` | **Yes (prod)** | Shared secret RevenueCat sends in `Authorization: Bearer <secret>`. Authenticates every incoming webhook. **Server-side only.** |
| `REVENUECAT_API_KEY` | Recommended | RevenueCat REST **secret** key (`sk_…`). Used to reconcile subscription state. Reconciliation is silently skipped if unset. **Server-side only.** |
| `REVENUECAT_API_URL` | No | Override the RevenueCat REST base URL. Defaults to `https://api.revenuecat.com/v1`. Useful for a mock server in tests. |
| `REVENUECAT_ENTITLEMENT_ESSENCIAL` | No | Entitlement id mapped to the Essencial tier. Default `essencial`. Must match the RevenueCat dashboard. |
| `REVENUECAT_ENTITLEMENT_PRO` | No | Entitlement id mapped to the Pro tier. Default `pro`. Must match the RevenueCat dashboard. |
| `FREE_MAX_LISTS` | No | Cap on lists per free user. Default `1`. |
| `FREE_MAX_ITEMS` | No | Cap on items per free user (across all lists). Default `50`. |
| `FREE_MAX_AI_CALLS_PER_MONTH` | No | Cap on `/ai/analyze` calls per calendar month for free users. Default `10`. |
| `ESSENCIAL_MAX_LISTS` / `ESSENCIAL_MAX_ITEMS` | No | Essencial caps. Defaults `3` / `70`. |
| `PRO_MAX_LISTS` / `PRO_MAX_ITEMS` | No | Pro caps. Defaults `5` / `150`. |

> AI is **unlimited** on both paid tiers and is not configurable via env.

> ⚠️ The **public** RevenueCat SDK keys (used by the mobile app) are *not* the same as
> `REVENUECAT_API_KEY`/`REVENUECAT_WEBHOOK_SECRET`. The two server secrets must never be shipped
> in the app bundle.

Set lower values in development (e.g. `FREE_MAX_LISTS=1`) to exercise caps quickly.

---

## RevenueCat Setup

### 1. Create a RevenueCat Project

1. Sign up at [app.revenuecat.com](https://app.revenuecat.com).
2. Create a new **Project** (e.g. `Circulari`).
3. Under **API Keys**, copy the **Secret key (sk_…)** → `REVENUECAT_API_KEY` (server).
   Copy the **public SDK keys** (Apple + Google) separately for the mobile app.

### 2. Connect the Apple App Store

**In App Store Connect:**

1. **Users and Access → Keys → App Store Connect API**: generate a **Developer** key, download
   the `.p8`, note the **Key ID** and **Issuer ID**.
2. Under your app → **Subscriptions**, create a **Subscription Group** (e.g. `Circulari`).
3. Inside it, create **two** monthly subscription products:
   - `com.circulari.essencial.monthly` — R$ 19,90
   - `com.circulari.pro.monthly` — R$ 49,90
   - Set pricing, duration (1 month), localisations; submit for review (or use sandbox).

**In RevenueCat → App Settings → Apple App Store:** enter Bundle ID, the `.p8` content,
Key ID, and Issuer ID. RevenueCat imports the products.

### 3. Connect the Google Play Store

**In Google Play Console → Monetize → Products → Subscriptions:** create the same two products
(`com.circulari.essencial.monthly`, `com.circulari.pro.monthly`). Link the app to a Google Cloud
project, enable the **Google Play Android Developer API**, create a Service Account with
**Pub/Sub Admin** + **Monitoring Viewer**, download the JSON key.

**In RevenueCat → App Settings → Google Play Store:** enter the Package Name and upload the
Service Account JSON.

### 4. Define Products, Entitlements, and the Offering

1. **Products**: create one product per store product id above.
2. **Entitlements**: create **two** — `essencial` and `pro` (these strings must match
   `REVENUECAT_ENTITLEMENT_ESSENCIAL` / `REVENUECAT_ENTITLEMENT_PRO`).
   - Attach the Essencial products (Apple + Google) to `essencial`.
   - Attach the Pro products (Apple + Google) to `pro`.
3. **Offerings**: create a default offering with two packages (Essencial, Pro) so the app's
   paywall can render both.

> The backend resolves the tier from the **active entitlement id** (`pro` > `essencial`).
> The offering/packages are for the mobile paywall UI.

### 5. Configure the Webhook

1. **Project Settings → Integrations → Webhooks → Add**:
   - **URL**: `https://your-api.com/api/v1/webhooks/revenuecat`
   - **Authorization header value**: a strong random string (`openssl rand -base64 32`) →
     `REVENUECAT_WEBHOOK_SECRET`.
2. Enable all event types (unknown/irrelevant types are safely ignored).
3. **Send test notification** to verify a 200.

### 6. Set the App User ID

RevenueCat's `app_user_id` must equal the Circulari `user.id` (UUID):

```dart
// Flutter — call after login/register and on session restore, BEFORE any purchase
await Purchases.logIn(currentUser.id);
```

Webhooks then reference the correct backend user. Events whose `app_user_id` is not a UUID
(e.g. a pre-login `$RCAnonymousID:…`) are recorded for idempotency but never change a tier.

---

## How the Backend Handles Subscriptions

### Webhook flow

```
RevenueCat → POST /api/v1/webhooks/revenuecat
  1. verifySignature — timing-safe compare of Authorization header to REVENUECAT_WEBHOOK_SECRET
  2. resolveTier     — from event.type + event.entitlement_ids:
       INITIAL_PURCHASE, RENEWAL, UNCANCELLATION, PRODUCT_CHANGE, BILLING_ISSUE
         → tier from active entitlement_ids (pro > essencial).
           Empty/unrecognized entitlement_ids → no change.
       EXPIRATION                              → "free"
       CANCELLATION, NON_RENEWING_PURCHASE, TRANSFER, TEST → no change (ignored)
  3. processEvent    — records event_id (dedup) AND applies the tier only if
                       event_timestamp_ms ≥ users.tier_event_at (out-of-order guard),
                       all inside one transaction.
```

- **Dedup**: duplicate `event.id` → 200, no re-apply.
- **Out-of-order guard**: a stale/retried event older than the last applied change is recorded
  but does not regress the tier. `users.tier_event_at` tracks the last applied event time.
- **`BILLING_ISSUE`**: not a blind grant — the tier is whatever the still-present (grace-period)
  entitlement maps to; it drops to `free` only when an `EXPIRATION` arrives.
- Non-200 responses cause RevenueCat to retry on a 5 / 10 / 20 / 40 / 80 min back-off.

### Reconciliation

`reconcileUser` calls `GET /subscribers/:userId` on the RevenueCat REST API, collects the
**active** entitlements (no/future `expires_date`), and sets `users.tier` to the highest match
(`pro` > `essencial`, else `free`). The REST snapshot is current truth, so it always wins over
the ordering guard. It runs in two places:

- **On login** (`POST /auth/login`) — fire-and-forget, 5 s timeout; catches a permanently missed
  webhook.
- **On demand** (`POST /plan/reconcile`) — **awaited**; the app calls this right after a
  purchase/restore so the new tier is reflected immediately instead of waiting for the webhook.
  Returns fresh plan usage. Per-user rate-limited (5/min) because it makes an outbound call.

Reconciliation is skipped silently if `REVENUECAT_API_KEY` is not set — safe for local dev.

### Limit enforcement

| Endpoint | Guard |
|----------|-------|
| `POST /lists` | `withListCapLock` — advisory lock + count check inside a transaction |
| `POST /items` | `withItemCapLock` — advisory lock + count check inside a transaction |
| `POST /ai/analyze` | `reserveAiCall` — atomic upsert with a conditional WHERE clause |

When a cap is exceeded, a guarded endpoint returns:

```json
{ "statusCode": 403, "message": "Forbidden", "code": "LIMIT_REACHED", "limit": 1 }
```

`limit` reflects the user's current tier cap (`Infinity` for unlimited AI → the check is skipped).

> **Downgrade over cap**: if a Pro user (5 lists / 150 items) drops to Essencial (3 / 70) or
> Free (1 / 50), existing rows are **kept** — caps block only *new* creates (`count >= max`).
> `GET /plan` may then report `used > max` (e.g. `lists: { used: 5, max: 3 }`); the app renders
> this without error and the user can create again once back under the cap.

### Security hardening

- Public webhook is rate-limited by IP; `POST /plan/reconcile` by user id.
- Request bodies are capped at 64 kb.
- `processed_webhook_events` rows are pruned daily after 30 days (`WebhookCleanupService`).
- `app_user_id` is validated as a UUID before any tier mutation.

---

## Testing Locally

### Lower the caps

```env
FREE_MAX_LISTS=1
FREE_MAX_ITEMS=3
FREE_MAX_AI_CALLS_PER_MONTH=2
```

Restart the dev server (env is read at boot via `ConfigService`).

### Simulate a webhook

```bash
curl -X POST http://localhost:3000/api/v1/webhooks/revenuecat \
  -H "Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "id": "evt-test-001",
      "type": "INITIAL_PURCHASE",
      "app_user_id": "<USER_UUID>",
      "entitlement_ids": ["pro"],
      "event_timestamp_ms": 1700000000000
    }
  }'
# → 200 {"received":true}  user.tier is now "pro"
```

Use `"entitlement_ids": ["essencial"]` for the Essencial tier, or `"type": "EXPIRATION"` to flip
back to `free`. Re-sending the same `event.id` returns 200 with no DB write (idempotency). Sending
an event with an **older** `event_timestamp_ms` than the last applied one is ignored (ordering
guard).

### Verify plan usage via API

```bash
curl http://localhost:3000/api/v1/plan \
  -H "Authorization: Bearer <JWT>"
# → 200 { "plan": "free", "lists": {"used":1,"max":1}, "items": {"used":5,"max":50}, "aiCalls": {"used":2,"max":10} }
```

On paid tiers, `aiCalls.max` is `null` (unlimited). Force an immediate refresh after a purchase:

```bash
curl -X POST http://localhost:3000/api/v1/plan/reconcile -H "Authorization: Bearer <JWT>"
# → 200 with the freshly reconciled plan usage
```

### Test a wrong webhook secret

```bash
curl -X POST http://localhost:3000/api/v1/webhooks/revenuecat \
  -H "Authorization: Bearer wrong-secret" -H "Content-Type: application/json" \
  -d '{"event":{"id":"x","type":"TEST","app_user_id":"y"}}'
# → 401 Unauthorized
```

---

## Production Checklist

- [ ] `REVENUECAT_WEBHOOK_SECRET` set to a cryptographically random value (`openssl rand -base64 32`)
- [ ] `REVENUECAT_API_KEY` set to the RevenueCat **secret** key (enables reconciliation)
- [ ] `REVENUECAT_ENTITLEMENT_ESSENCIAL` / `REVENUECAT_ENTITLEMENT_PRO` match the dashboard entitlement ids
- [ ] Webhook URL registered in RevenueCat, pointing at the production API
- [ ] Apple + Google products created for **both** Essencial (R$ 19,90) and Pro (R$ 49,90)
- [ ] RevenueCat entitlements `essencial` and `pro` each have their Apple + Google products attached
- [ ] Default offering exposes both packages to the app
- [ ] Mobile app ships only the **public** SDK keys; server secrets are not in the bundle
- [ ] Mobile app calls `Purchases.logIn(user.id)` after authentication and on session restore
- [ ] **Send test notification** returns 200 from production
- [ ] Tier cap env vars reviewed (defaults: free 1/50/10, essencial 3/70/∞, pro 5/150/∞)
