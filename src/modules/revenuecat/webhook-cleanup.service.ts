import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { RevenueCatRepository } from './revenuecat.repository';

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * The `processed_webhook_events` table grows with every delivery and is only
 * needed for short-window idempotency. Prune old rows daily so it stays bounded.
 */
@Injectable()
export class WebhookCleanupService {
  private readonly logger = new Logger(WebhookCleanupService.name);

  constructor(private readonly repository: RevenueCatRepository) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async pruneProcessedEvents(): Promise<void> {
    const cutoff = new Date(Date.now() - RETENTION_MS);
    try {
      const deleted = await this.repository.deleteProcessedEventsOlderThan(cutoff);
      if (deleted > 0) {
        this.logger.log(`Pruned ${deleted} processed webhook events older than 30 days`);
      }
    } catch (err) {
      this.logger.warn(
        `Failed to prune processed webhook events: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
