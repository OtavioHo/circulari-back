---
layout: home

hero:
  name: Circulari
  text: Inventory management via photo + AI
  tagline: Catalog physical items. Get AI-powered name, category, and value suggestions.
---

## Docs Map

| File | When to read |
|------|-------------|
| [Architecture](./architecture) | Stack, data flow, layer patterns, key decisions |
| [Data Models](./data-models) | DB schema and field definitions |
| [API](./api) | Endpoints, request/response shapes |
| [AI Integration](./ai) | OpenAI flow, prompt format, price normalization |
| [Infrastructure](./infra) | Stack overview, environment variables |
| [Deployment](./deployment) | GCP Cloud Run runbook: deploy, redeploy, change config/secrets |
| [Roadmap](./roadmap) | Milestones and implementation status |
| [Monetization](./monetization) | Tier limits, RevenueCat setup, app store configuration |

## Feature Status Summary

| Feature | Status |
|---------|--------|
| Auth (email + social) | <Badge type="warning" text="In Progress" /> |
| Lists CRUD | <Badge type="tip" text="Implemented" /> |
| Items CRUD | <Badge type="tip" text="Implemented" /> |
| Image upload + storage | <Badge type="tip" text="Implemented" /> |
| AI image analysis | <Badge type="tip" text="Implemented" /> |
| Dashboard + search | <Badge type="tip" text="Implemented" /> |
| Monetization tiers | <Badge type="tip" text="Implemented" /> |

## Cost Estimates by MAU Tier

Estimated monthly cost per hosting stack. See [full breakdown](./infrastructure-costs) for details.

| Stack | 100 MAU | 1K MAU | 10K MAU | 50K MAU |
|-------|---------|--------|---------|---------|
| **VPS + R2 (budget)** | ~$21 | ~$29 | ~$127 | ~$564 |
| **AWS Full (Lightsail + RDS + S3)** | ~$44 | ~$67 | ~$238 | ~$866 |

> Includes compute, database, storage, AI (GPT-4o-mini), and additional services (push notifications, email, monitoring, app store fees).
