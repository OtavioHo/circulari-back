import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { RevenueCatRepository } from './revenuecat.repository';
import { RevenueCatWebhookBody } from './dto/webhook-event.dto';

type Tier = 'free' | 'premium';

const PREMIUM_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'BILLING_ISSUE',
]);
const FREE_EVENTS = new Set(['EXPIRATION']);
const IGNORED_EVENTS = new Set(['CANCELLATION', 'NON_RENEWING_PURCHASE', 'TRANSFER', 'TEST']);

function resolveTier(eventType: string): Tier | null {
  if (PREMIUM_EVENTS.has(eventType)) return 'premium';
  if (FREE_EVENTS.has(eventType)) return 'free';
  if (IGNORED_EVENTS.has(eventType)) return null;
  return null;
}

@Injectable()
export class RevenueCatService {
  private readonly logger = new Logger(RevenueCatService.name);
  private readonly webhookSecret?: string;
  private readonly apiKey?: string;
  private readonly apiBaseUrl: string;

  constructor(
    config: ConfigService,
    private readonly repository: RevenueCatRepository,
  ) {
    this.webhookSecret = config.get<string>('REVENUECAT_WEBHOOK_SECRET');
    this.apiKey = config.get<string>('REVENUECAT_API_KEY');
    this.apiBaseUrl = config.get<string>('REVENUECAT_API_URL', 'https://api.revenuecat.com/v1');
  }

  verifySignature(authorizationHeader: string | undefined): void {
    if (!this.webhookSecret) {
      throw new UnauthorizedException('Webhook secret not configured');
    }
    if (!authorizationHeader) {
      throw new UnauthorizedException('Missing authorization header');
    }
    const token = authorizationHeader.replace(/^Bearer\s+/i, '').trim();
    const tokenBuf = Buffer.from(token);
    const secretBuf = Buffer.from(this.webhookSecret);
    if (tokenBuf.length !== secretBuf.length || !timingSafeEqual(tokenBuf, secretBuf)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }

  async handleWebhook(body: RevenueCatWebhookBody): Promise<void> {
    const event = body?.event;
    if (!event?.id || !event.type) {
      throw new BadRequestException('Invalid webhook payload');
    }
    const userId = event.app_user_id ?? event.original_app_user_id;
    if (!userId) {
      throw new BadRequestException('Missing app_user_id');
    }

    const tier = resolveTier(event.type);
    const result = await this.repository.processEvent(event.id, userId, tier);

    if (result.duplicate) {
      this.logger.log(`Duplicate event ${event.id} ignored`);
      return;
    }
    if (tier && !result.userUpdated) {
      this.logger.warn(`Webhook event ${event.id} references unknown user ${userId}`);
    }
  }

  /**
   * Reconcile user tier with RevenueCat's source of truth.
   * Called on login so a missed webhook is eventually corrected.
   */
  async reconcileUser(userId: string): Promise<void> {
    if (!this.apiKey) return;

    let data: unknown;
    try {
      const res = await fetch(`${this.apiBaseUrl}/subscribers/${encodeURIComponent(userId)}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      if (!res.ok) {
        this.logger.warn(`Reconcile failed for ${userId}: HTTP ${res.status}`);
        return;
      }
      data = await res.json();
    } catch (err) {
      this.logger.warn(
        `Reconcile request failed for ${userId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return;
    }

    const tier = this.tierFromSubscriber(data);
    if (tier === null) return;
    await this.repository.updateUserTier(userId, tier);
  }

  private tierFromSubscriber(data: unknown): Tier | null {
    const subscriber = (data as { subscriber?: unknown })?.subscriber;
    if (!subscriber || typeof subscriber !== 'object') {
      this.logger.warn('Skipping tier reconciliation: missing or malformed subscriber payload');
      return null;
    }

    const entitlements = (subscriber as { entitlements?: unknown }).entitlements;
    if (entitlements === undefined || entitlements === null) return 'free';
    if (typeof entitlements !== 'object') {
      this.logger.warn(
        'Skipping tier reconciliation: malformed entitlements in RevenueCat response',
      );
      return null;
    }

    const now = Date.now();
    for (const value of Object.values(entitlements as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') {
        this.logger.warn('Skipping tier reconciliation: malformed entitlement entry');
        return null;
      }
      const expires = (value as { expires_date?: unknown }).expires_date;
      if (expires === undefined || expires === null) return 'premium';
      if (typeof expires !== 'string') {
        this.logger.warn('Skipping tier reconciliation: invalid expires_date type');
        return null;
      }
      const expiresAt = Date.parse(expires);
      if (isNaN(expiresAt)) {
        this.logger.warn('Skipping tier reconciliation: unparseable expires_date');
        return null;
      }
      if (expiresAt > now) return 'premium';
    }
    return 'free';
  }
}
