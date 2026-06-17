import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { RevenueCatRepository } from './revenuecat.repository';
import { RevenueCatEvent, RevenueCatWebhookBody } from './dto/webhook-event.dto';
import { Tier } from '../tiers/tier-limits.config';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Events that reflect an *active* (or grace-period) subscription. The target
 * tier is derived from the entitlement ids on the event, never from the event
 * type alone — an event carrying no recognized entitlement grants nothing.
 *
 * `BILLING_ISSUE` is included: RevenueCat keeps the entitlement present during
 * the billing grace period, so the paid tier is preserved while in grace and
 * naturally drops once the entitlement disappears.
 */
const GRANTING_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'PRODUCT_CHANGE',
  'BILLING_ISSUE',
]);
const FREE_EVENTS = new Set(['EXPIRATION']);
// All other types (CANCELLATION, NON_RENEWING_PURCHASE, TRANSFER, TEST, unknown)
// fall through to `null` in resolveTier and never change the tier.

@Injectable()
export class RevenueCatService {
  private readonly logger = new Logger(RevenueCatService.name);
  private readonly webhookSecret?: string;
  private readonly apiKey?: string;
  private readonly apiBaseUrl: string;
  private readonly essencialEntitlement: string;
  private readonly proEntitlement: string;

  constructor(
    config: ConfigService,
    private readonly repository: RevenueCatRepository,
  ) {
    this.webhookSecret = config.get<string>('REVENUECAT_WEBHOOK_SECRET');
    this.apiKey = config.get<string>('REVENUECAT_API_KEY');
    this.apiBaseUrl = config.get<string>('REVENUECAT_API_URL', 'https://api.revenuecat.com/v1');
    this.essencialEntitlement = config.get<string>('REVENUECAT_ENTITLEMENT_ESSENCIAL', 'essencial');
    this.proEntitlement = config.get<string>('REVENUECAT_ENTITLEMENT_PRO', 'pro');
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

  /**
   * Maps a set of active entitlement ids to a tier. Pro outranks Essencial when
   * both are present. No recognized entitlement → `free`.
   */
  private tierFromEntitlementIds(ids: readonly string[]): Tier {
    if (ids.includes(this.proEntitlement)) return 'pro';
    if (ids.includes(this.essencialEntitlement)) return 'essencial';
    return 'free';
  }

  /**
   * Resolves the target tier for a webhook event, or `null` when the event
   * should not change the tier (ignored types, or a granting event that carries
   * no recognized entitlement — e.g. a malformed/partial payload).
   */
  private resolveTier(event: RevenueCatEvent): Tier | null {
    const type = event.type ?? '';
    if (FREE_EVENTS.has(type)) return 'free';
    if (GRANTING_EVENTS.has(type)) {
      const ids = this.entitlementIds(event);
      if (ids.length === 0) return null;
      const tier = this.tierFromEntitlementIds(ids);
      // A granting event whose entitlements are all unrecognized grants nothing.
      return tier === 'free' ? null : tier;
    }
    // CANCELLATION / NON_RENEWING_PURCHASE / TRANSFER / TEST / unknown.
    return null;
  }

  private entitlementIds(event: RevenueCatEvent): string[] {
    if (Array.isArray(event.entitlement_ids)) {
      return event.entitlement_ids.filter((id): id is string => typeof id === 'string');
    }
    if (typeof event.entitlement_id === 'string') return [event.entitlement_id];
    return [];
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

    // Our app_user_id is always the backend user UUID (set via Purchases.logIn).
    // Anonymous/malformed ids (e.g. pre-login `$RCAnonymousID:…`) can never match
    // a user, so skip the tier mutation while still recording the event for
    // idempotency. Returning 200 (not 400) avoids RevenueCat retry storms.
    const tier = UUID_RE.test(userId) ? this.resolveTier(event) : null;
    if (tier === null && !UUID_RE.test(userId)) {
      this.logger.log(`Event ${event.id} has non-UUID app_user_id; recording without tier change`);
    }
    const eventAt =
      typeof event.event_timestamp_ms === 'number'
        ? new Date(event.event_timestamp_ms)
        : new Date();
    const result = await this.repository.processEvent(event.id, userId, tier, eventAt);

    if (result.duplicate) {
      this.logger.log(`Duplicate event ${event.id} ignored`);
      return;
    }
    if (result.stale) {
      this.logger.log(`Stale event ${event.id} (older than last applied) ignored`);
      return;
    }
    if (tier && !result.userUpdated) {
      this.logger.warn(`Webhook event ${event.id} references unknown user ${userId}`);
    }
  }

  /**
   * Reconcile user tier with RevenueCat's source of truth. The REST snapshot is
   * the current truth, so it always wins over the per-user ordering guard.
   * Called on login and on-demand after a purchase so a missed/late webhook is
   * corrected deterministically.
   */
  async reconcileUser(userId: string): Promise<void> {
    if (!this.apiKey) return;

    let data: unknown;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    try {
      const res = await fetch(`${this.apiBaseUrl}/subscribers/${encodeURIComponent(userId)}`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: controller.signal,
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
    } finally {
      clearTimeout(timeout);
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
    const activeIds: string[] = [];
    for (const [id, value] of Object.entries(entitlements as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') {
        this.logger.warn('Skipping tier reconciliation: malformed entitlement entry');
        return null;
      }
      const expires = (value as { expires_date?: unknown }).expires_date;
      if (expires === undefined || expires === null) {
        activeIds.push(id);
        continue;
      }
      if (typeof expires !== 'string') {
        this.logger.warn('Skipping tier reconciliation: invalid expires_date type');
        return null;
      }
      const expiresAt = Date.parse(expires);
      if (isNaN(expiresAt)) {
        this.logger.warn('Skipping tier reconciliation: unparseable expires_date');
        return null;
      }
      if (expiresAt > now) activeIds.push(id);
    }
    return this.tierFromEntitlementIds(activeIds);
  }
}
