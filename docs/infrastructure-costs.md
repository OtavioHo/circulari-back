# Infrastructure & Operational Cost Estimates

## Assumptions

Based on the Circulari architecture: NestJS API + PostgreSQL + S3-compatible storage + OpenAI Vision API.

### Per-User Usage Estimates

| Metric | Value | Notes |
|--------|-------|-------|
| Lists per user | 3-5 | Accumulated over time |
| Items per list | 15-20 | Average |
| Images per item | 1.2 | Most items have 1 image |
| Avg image size | 500 KB | Compressed JPEG from mobile |
| AI calls/month (active user) | 8 | Each new item triggers 1 `POST /ai/analyze` |
| API requests/month (active user) | ~300 | CRUD, search, dashboard, auth |
| DB rows per user | ~100 | Users + Lists + Items + ItemImages + Categories (shared) |
| Storage per user (accumulated) | ~40 MB | 80 images x 500 KB over lifetime |

### User Tiers

| Tier | MAU | Description |
|------|-----|-------------|
| MVP | 100 | Beta / soft launch |
| Early | 1,000 | Early traction |
| Growth | 10,000 | Product-market fit |
| Scale | 50,000 | Scaling up |

---

## 1. AI Costs (OpenAI)

This is the largest variable cost and scales linearly with item creation.

### Per-Call Cost

| Model | Input Tokens | Output Tokens | Cost/Call |
|-------|-------------|---------------|-----------|
| GPT-4o-mini (recommended) | ~3,200 (image + prompt) | ~150 (JSON) | **~$0.001** |
| GPT-4o | ~3,200 | ~150 | **~$0.01** |

> Pricing: GPT-4o-mini input $0.15/1M, output $0.60/1M. GPT-4o input $2.50/1M, output $10.00/1M.
> Image at `detail: low` = ~2,833 tokens. Prompt text = ~350 tokens.

### Monthly AI Cost by Tier

| Tier | MAU | Calls/mo | GPT-4o-mini | GPT-4o |
|------|-----|----------|-------------|--------|
| MVP | 100 | 800 | **$0.80** | **$8** |
| Early | 1,000 | 8,000 | **$8** | **$80** |
| Growth | 10,000 | 80,000 | **$80** | **$800** |
| Scale | 50,000 | 400,000 | **$400** | **$4,000** |

**Recommendation**: Use GPT-4o-mini — quality is sufficient for item recognition/categorization at 10x lower cost. Reserve GPT-4o for a future "premium analysis" feature on paid tiers.

---

## 2. Object Storage (Images)

### Accumulated Storage by Tier

| Tier | MAU | Images stored (cumulative, 6 months) | Storage |
|------|-----|--------------------------------------|---------|
| MVP | 100 | 5,000 | 2.5 GB |
| Early | 1,000 | 50,000 | 25 GB |
| Growth | 10,000 | 500,000 | 250 GB |
| Scale | 50,000 | 2,500,000 | 1.2 TB |

### Provider Comparison

| Provider | Storage/GB/mo | Egress/GB | PUT per 1K | GET per 1K | Free Tier |
|----------|---------------|-----------|------------|------------|-----------|
| **Cloudflare R2** | $0.015 | **$0 (free)** | $0.0036 | $0.0036 | 10 GB storage, 1M reads, 1M writes/mo |
| **AWS S3** | $0.023 | $0.09 | $0.005 | $0.0004 | 5 GB (12 months) |

### Monthly Storage Cost

| Tier | Cloudflare R2 | AWS S3 (+ egress) |
|------|---------------|---------------------|
| MVP (2.5 GB) | **$0** (free tier) | ~$0.10 |
| Early (25 GB) | **$0.38** | ~$3 + egress | 
| Growth (250 GB) | **$3.75** | ~$25 + egress | 
| Scale (1.2 TB) | **$18** | ~$120 + egress |

**Recommendation**: **Cloudflare R2** is the clear winner — zero egress fees are critical for an image-heavy mobile app. Already supported in your codebase via the storage abstraction. DigitalOcean Spaces is a solid flat-rate alternative at lower tiers.

---

## 3. Database (PostgreSQL)

### Storage Estimate

| Tier | MAU | Total rows (approx) | DB size (est.) |
|------|-----|---------------------|----------------|
| MVP | 100 | 10,000 | ~50 MB |
| Early | 1,000 | 100,000 | ~500 MB |
| Growth | 10,000 | 1,000,000 | ~5 GB |
| Scale | 50,000 | 5,000,000 | ~25 GB |

### Provider Comparison

| Provider | Offering | Specs | Price/mo | Notes |
|----------|----------|-------|----------|-------|
| **Self-managed** (self-managed) | PostgreSQL on VPS | Shared with API | **$0** (included in VPS) | You manage backups/updates |
| **AWS RDS** | Managed DB (db.t4g.micro) | 2 vCPU, 1 GB, 20 GB | **~$15-20** | Free tier for 12 months |

### Monthly DB Cost by Tier

| Tier | Self-managed | Supabase | Neon | DO Managed | AWS RDS |
|------|------------------------|----------|------|------------|---------|
| MVP | **$0** | **$0** (free) | **$0** (free) | $15 | ~$15 |
| Early | **$0** | **$25** | **$19** | $15 | ~$15 |
| Growth | **$0** | **$25** | **$69** | $50 (scale up) | ~$50 |
| Scale | **+$10** (bigger VPS) | **$25+** | **$69+** | $100+ | $100+ |

**Recommendation**: Start with **self-managed PostgreSQL on the VPS**. Move to **Supabase** or **Neon** if you need managed backups and don't want ops overhead. For the MVP, the free tiers of Supabase/Neon are unbeatable.

---

## 4. Server / Compute (NestJS API)

### Resource Needs

| Tier | MAU | Req/sec (peak) | vCPU | RAM | Notes |
|------|-----|----------------|------|-----|-------|
| MVP | 100 | <1 | 1 | 1 GB | NestJS is idle most of the time |
| Early | 1,000 | ~5 | 1-2 | 2 GB | Single instance sufficient |
| Growth | 10,000 | ~30 | 2-4 | 4 GB | May need horizontal scaling |
| Scale | 50,000 | ~100+ | 4-8 | 8+ GB | Multiple instances + load balancer |

### Provider Comparison

| Provider | Offering | Specs | Price/mo | Pros | Cons |
|----------|----------|-------|----------|------|------|
| **VPS** | - | 2 vCPU, 4 GB, 40 GB | **(~$10)** | - | No managed services |
| **DigitalOcean** | Droplet | 2 vCPU, 4 GB, 80 GB | **$24** | Good docs, managed DB add-on | More expensive than VPS |
| **Railway** | App service | Usage-based | **~$5-25** | Zero DevOps, git-push deploy | Costs climb fast at scale |
| **Fly.io** | Machine | shared-cpu-2x, 1 GB | **~$6** | Edge deploy, auto-scale | Complexity, Postgres self-managed |
| **AWS Lightsail** | Instance | 2 vCPU, 4 GB | **$24** | Simple AWS, fixed price | Limited compared to full AWS |
| **AWS EC2** | t4g.medium | 2 vCPU, 4 GB | **~$25** | Full AWS ecosystem | Complex, reserved instances cheaper |
| **Coolify** (self-hosted) | On VPS | Same as VPS | **$0** (on VPS) | PaaS experience, self-hosted | Extra setup |

### Monthly Compute Cost by Tier

| Tier | VPS | DO Droplet | Railway | Render | Fly.io | AWS Lightsail |
|------|-----|------------|---------|--------|--------|---------------|
| MVP | **~$10** | $12 | ~$5 | $7 | ~$3 | $12 |
| Early | **~$10** | $24 | ~$15 | $25 | ~$6 | $24 |
| Growth | **~$18** | $48 | ~$40 | $85 | ~$25 | $48 |
| Scale | **~$36** | $96 | ~$100+ | $170+ | ~$60 | $96 |

**Recommendation**: A **budget VPS** (e.g. Hetzner, OVH, Contabo, Hostinger) for the best price-to-performance ratio. Use **Railway** or **Render** if you want zero-ops deployments and accept higher costs. At scale, consider AWS with reserved instances.

---

## 5. Additional Costs

| Item | Cost | Notes |
|------|------|-------|
| Domain | ~$12/year | .com.br or .com |
| SSL/TLS | **$0** | Let's Encrypt (auto-renew via Certbot or Caddy) |
| Email (transactional) | **$0-3/mo** | Resend free tier: 100 emails/day; SendGrid: 100/day free |
| Monitoring | **$0** | UptimeRobot free (50 monitors), or Betterstack free tier |
| Error tracking | **$0** | Sentry free tier (5K events/mo) |
| CI/CD | **$0** | GitHub Actions free for public repos, 2K min/mo for private |
| CDN | **$0** | Cloudflare free plan (if using R2, it's integrated) |
| Daily DB backup | **$0-2/mo** | Cron + pg_dump to R2 (negligible storage cost) |

---

## 6. Total Monthly Cost — Comparison by Stack

### Stack A: Budget (VPS + R2 + Self-managed)

Best value. You manage the server, but Docker + docker-compose makes it manageable.

| Component | MVP (100) | Early (1K) | Growth (10K) | Scale (50K) |
|-----------|-----------|------------|--------------|-------------|
| Server (VPS) | $10 | $10 | $18 | $36 |
| Database (self-managed) | $0 | $0 | $0 | $5 |
| Storage (Cloudflare R2) | $0 | $0.40 | $3.75 | $18 |
| AI (GPT-4o-mini) | $0.80 | $8 | $80 | $400 |
| Extras | $2 | $2 | $5 | $10 |
| **Total** | **~$13/mo** | **~$21/mo** | **~$107/mo** | **~$469/mo** |

### Stack B: Balanced (DigitalOcean + R2)

Managed database, good documentation, slightly more expensive.

| Component | MVP (100) | Early (1K) | Growth (10K) | Scale (50K) |
|-----------|-----------|------------|--------------|-------------|
| Server (DO Droplet) | $12 | $24 | $48 | $96 |
| Database (DO Managed) | $15 | $15 | $50 | $100 |
| Storage (Cloudflare R2) | $0 | $0.40 | $3.75 | $18 |
| AI (GPT-4o-mini) | $0.80 | $8 | $80 | $400 |
| Extras | $2 | $2 | $5 | $10 |
| **Total** | **~$30/mo** | **~$50/mo** | **~$187/mo** | **~$624/mo** |

### Stack C: Zero-Ops PaaS (Railway + Neon + R2)

Git-push deploys, managed everything. Highest cost, lowest ops burden.

| Component | MVP (100) | Early (1K) | Growth (10K) | Scale (50K) |
|-----------|-----------|------------|--------------|-------------|
| Server (Railway) | $5 | $15 | $40 | $100 |
| Database (Neon) | $0 | $19 | $69 | $69+ |
| Storage (Cloudflare R2) | $0 | $0.40 | $3.75 | $18 |
| AI (GPT-4o-mini) | $0.80 | $8 | $80 | $400 |
| Extras | $2 | $2 | $5 | $10 |
| **Total** | **~$8/mo** | **~$45/mo** | **~$198/mo** | **~$597/mo** |

### Stack D: AWS Full (Lightsail + RDS + S3)

Enterprise-grade, full AWS ecosystem. Good if you need compliance or are already in AWS.

| Component | MVP (100) | Early (1K) | Growth (10K) | Scale (50K) |
|-----------|-----------|------------|--------------|-------------|
| Server (Lightsail) | $12 | $24 | $48 | $96 |
| Database (RDS) | $15 | $15 | $50 | $100 |
| Storage (S3 + egress) | $1 | $5 | $30 | $150 |
| AI (GPT-4o-mini) | $0.80 | $8 | $80 | $400 |
| Extras | $5 | $5 | $10 | $20 |
| **Total** | **~$34/mo** | **~$57/mo** | **~$218/mo** | **~$766/mo** |

---

## 7. Additional Services

Beyond the core stack, a production mobile app needs several supporting services.

### Push Notifications

Required for engagement (new item matches, list updates, payment reminders).

| Provider | Free Tier | Paid | Notes |
|----------|-----------|------|-------|
| **Firebase Cloud Messaging (FCM)** | **Unlimited** | $0 | Required for Android, works on iOS too. Industry standard. |
| **OneSignal** | 10K subscribers | $9/mo+ | Easier setup, analytics dashboard |
| **Apple APNs** | Unlimited (via FCM) | $0 | Used under the hood by FCM for iOS |

**Recommendation**: **FCM** — free, reliable, Flutter has excellent support via `firebase_messaging`. You'll need a Firebase project anyway for Crashlytics.

### App Store Fees

Non-negotiable costs for publishing your Flutter app.

| Platform | Cost | Notes |
|----------|------|-------|
| **Apple Developer Program** | **$99/year** | Required for App Store publishing |
| **Google Play Developer** | **$25 one-time** | Required for Play Store publishing |
| **App Store commission** | 15-30% of in-app purchases | 15% for small developers (<$1M revenue/year) |

### Payment Processing (Milestone 6 — Monetization)

For paid tier subscriptions and in-app purchases.

| Provider | Fee | Notes |
|----------|-----|-------|
| **RevenueCat** | Free up to $2.5K MTR, then $0 to $99/mo | Best for mobile subscriptions. Handles both App Store & Play Store receipts, webhooks to your API. |
| **Stripe** | 2.9% + $0.30/tx | Direct payment (web/API), not for in-app purchases |
| **App Store / Play Store billing** | 15-30% commission | Required for in-app purchases on mobile |

**Recommendation**: **RevenueCat** — it wraps both stores, handles receipt validation, subscription status webhooks, and analytics. Free tier is generous. Your backend just needs a webhook endpoint to update user tiers.

### Transactional Email

For password reset, welcome emails, account verification.

| Provider | Free Tier | Paid | Notes |
|----------|-----------|------|-------|
| **Resend** | 100 emails/day, 3K/mo | $20/mo (50K/mo) | Modern API, great DX, built by Vercel alumni |
| **SendGrid** | 100 emails/day | $20/mo (50K/mo) | Established, but heavier setup |
| **AWS SES** | 62K emails/mo (from EC2) | $0.10/1K | Cheapest at scale, harder setup |
| **Postmark** | 100 emails/mo | $15/mo (10K/mo) | Best deliverability |

**Recommendation**: **Resend** — excellent developer experience, NestJS-friendly, free tier covers MVP easily. Move to **AWS SES** at scale for cost.

### Analytics & Crash Reporting

| Provider | Free Tier | Paid | Notes |
|----------|-----------|------|-------|
| **Firebase Analytics + Crashlytics** | **Unlimited** | $0 | Standard for Flutter apps, real-time crash reports |
| **PostHog** | 1M events/mo | $0.00031/event after | Self-hostable, product analytics + session replay |
| **Mixpanel** | 20M events/mo | $28/mo+ | Good funnel analysis |
| **Sentry** (backend errors) | 5K events/mo | $26/mo (50K) | Best for backend error tracking, NestJS SDK available |

**Recommendation**: **Firebase Analytics + Crashlytics** for the Flutter app (free, no reason not to). **Sentry** free tier for backend error tracking.

### Caching Layer (Redis)

Needed at Growth+ tier for rate limiting AI calls, caching dashboard aggregations, and session management.

| Provider | Free Tier | Paid | Notes |
|----------|-----------|------|-------|
| **Upstash Redis** | 10K commands/day | $10/mo (200K cmds/day) | Serverless, pay-per-request, great for low traffic |
| **Railway Redis** | — | ~$5/mo (usage-based) | Simple if already on Railway |
| **Redis on VPS** | $0 (on your VPS) | — | Self-managed, add to docker-compose |
| **AWS ElastiCache** | — | $13/mo (t4g.micro) | Overkill for MVP |

**Recommendation**: **Self-hosted Redis on VPS** at MVP (add to docker-compose). **Upstash** if on Railway/serverless. Only needed once you implement rate limiting or caching.

### Log Management & Observability

| Provider | Free Tier | Paid | Notes |
|----------|-----------|------|-------|
| **Betterstack (Logtail)** | 1 GB/mo | $25/mo (5 GB) | Clean UI, structured logging |
| **Grafana Cloud** | 50 GB logs, 10K metrics | $0 | Generous free tier, Loki + Prometheus + Grafana |
| **Datadog** | — | $15/host/mo | Enterprise standard, expensive |
| **Docker logs + Loki** (self-hosted) | $0 | — | On your VPS, lightweight |

**Recommendation**: **Grafana Cloud free tier** or just Docker logs at MVP. Add structured logging when you need to debug production issues.

### Uptime Monitoring

| Provider | Free Tier | Notes |
|----------|-----------|-------|
| **UptimeRobot** | 50 monitors, 5-min checks | Simple, reliable |
| **Betterstack** | 5 monitors, 3-min checks | Status pages included |
| **Cronitor** | 5 monitors | Also cron job monitoring |

**Recommendation**: **UptimeRobot** free tier — set up monitors for your API health endpoint and website.

### CDN

| Provider | Free Tier | Notes |
|----------|-----------|-------|
| **Cloudflare** | Unlimited bandwidth | DDoS protection, caching, DNS — all free |
| **AWS CloudFront** | 1 TB/mo (12 months) | Good if on AWS |
| **Fastly** | — | $50/mo minimum |

**Recommendation**: **Cloudflare free plan** — if you're already using R2, you get integrated CDN for your images. Also gives you free DDoS protection and DNS management.

### Image Processing (Optional)

If you want to resize/compress images before storing (reduces storage costs and improves mobile performance).

| Provider | Free Tier | Paid | Notes |
|----------|-----------|------|-------|
| **Cloudflare Images** | — | $5/mo (100K images) | Transform + deliver |
| **Sharp (self-hosted)** | $0 | — | Node.js library, run on your API server |
| **Imgproxy (self-hosted)** | $0 | — | Docker container, on-the-fly resizing |

**Recommendation**: **Sharp** library in your NestJS pipeline — compress images on upload before sending to R2. Saves 40-60% storage costs, no extra service needed.

### Additional Services Cost Summary

| Service | MVP | Early | Growth | Scale |
|---------|-----|-------|--------|-------|
| Push Notifications (FCM) | $0 | $0 | $0 | $0 |
| App Store fees | $10/mo amortized | $10/mo | $10/mo | $10/mo |
| Payment processing (RevenueCat) | $0 | $0 | $0 | $0-99 |
| Transactional email (Resend) | $0 | $0 | $0-20 | $20 |
| Analytics (Firebase + Sentry) | $0 | $0 | $0 | $0-26 |
| Redis (self-hosted → Upstash) | $0 | $0 | $0-10 | $10 |
| Logs (Grafana Cloud) | $0 | $0 | $0 | $0-25 |
| Uptime monitoring | $0 | $0 | $0 | $0 |
| CDN (Cloudflare) | $0 | $0 | $0 | $0 |
| Image processing (Sharp) | $0 | $0 | $0 | $0 |
| **Subtotal** | **~$10/mo** | **~$10/mo** | **~$10-40/mo** | **~$40-190/mo** |

---

## 8. Revised Total Cost (Including Additional Services)

### Stack A: Budget (VPS + R2 + Self-managed) — Updated

| Component | MVP (100) | Early (1K) | Growth (10K) | Scale (50K) |
|-----------|-----------|------------|--------------|-------------|
| Server (VPS) | $10 | $10 | $18 | $36 |
| Database (self-managed) | $0 | $0 | $0 | $10 |
| Storage (Cloudflare R2) | $0 | $0.40 | $3.75 | $18 |
| AI (GPT-4o-mini) | $0.80 | $8 | $80 | $400 |
| Additional services | $10 | $10 | $25 | $100 |
| **Total** | **~$21/mo** | **~$29/mo** | **~$127/mo** | **~$564/mo** |

### Stack C: Zero-Ops PaaS (Railway + Neon + R2) — Updated

| Component | MVP (100) | Early (1K) | Growth (10K) | Scale (50K) |
|-----------|-----------|------------|--------------|-------------|
| Server (Railway) | $5 | $15 | $40 | $100 |
| Database (Neon) | $0 | $19 | $69 | $69+ |
| Storage (Cloudflare R2) | $0 | $0.40 | $3.75 | $18 |
| AI (GPT-4o-mini) | $0.80 | $8 | $80 | $400 |
| Additional services | $10 | $10 | $25 | $100 |
| **Total** | **~$16/mo** | **~$53/mo** | **~$218/mo** | **~$687/mo** |

---

## 9. Recommendations

### For MVP / Launch (100 users) — ~$21/mo

**Go with Stack A (VPS + R2)** or **Stack C (Railway + Neon + R2)**.

Both cost ~$16-21/mo including all supporting services. Stack A requires some DevOps knowledge (Docker on a VPS), Stack C is fully managed with git-push deploys.

**Specific setup:**
- Budget VPS (~$10/mo) running Docker with NestJS + PostgreSQL + Nginx
- Cloudflare R2 (free tier covers you) + Cloudflare free CDN/DNS
- GPT-4o-mini ($0.80/mo)
- Firebase (FCM + Analytics + Crashlytics) — $0
- Resend for emails — $0 (free tier)
- Sentry for backend errors — $0 (free tier)
- UptimeRobot — $0 (free tier)
- Apple Developer + Google Play — ~$10/mo amortized
- **Total: ~$21/mo**

### For Growth (1K-10K users) — $29-218/mo

**Stick with Stack A** if you're comfortable with server management, or **move to Stack B** (DigitalOcean managed DB) when you want automated backups.

At this stage, **AI becomes your dominant cost** ($8-80/mo). Key actions:
- Implement rate limits on free tier (e.g., 5 AI analyses/day)
- Add Redis for rate limiting (self-hosted or Upstash)
- Set up RevenueCat for in-app subscriptions
- Add Sharp for image compression on upload (saves storage costs)
- Consider adding Grafana Cloud for structured logging

### For Scale (50K users) — $564-687/mo

AI cost ($400/mo) dominates everything else. At this point:
- Monetization (paid tiers) must cover AI costs — even 10% of users paying $5/mo = $25K/mo revenue
- Consider negotiating OpenAI volume pricing or batched API calls
- Evaluate self-hosted models (LLaVA, Qwen-VL) for cost reduction
- Horizontal scaling: multiple API instances behind a load balancer
- Managed database becomes worth it (automated failover, replicas)
- RevenueCat paid tier ($99/mo) justified by subscription management needs

### Key Takeaways

1. **AI is your biggest variable cost** — at every tier, it's the fastest-growing line item. Gate it behind monetization tiers early.
2. **Use Cloudflare R2** — zero egress fees save you 60-80% vs S3 for image-heavy workloads. Already supported in your code.
3. **Leverage free tiers aggressively** — Firebase (push + analytics + crashes), R2 (10 GB), Neon/Supabase (DB), Sentry, Grafana Cloud, Resend, UptimeRobot — all free at MVP scale.
4. **Start cheap, scale up** — a budget VPS or Railway at MVP, add managed services as complexity demands it.
5. **Don't over-provision** — 100 users generates <1 req/sec. A $10 VPS handles this comfortably.
6. **Apple/Google store fees are unavoidable** — budget $124/year minimum, plus 15-30% commission on any in-app revenue.
7. **Add Sharp image compression early** — reduces storage costs 40-60% and improves mobile app performance.
