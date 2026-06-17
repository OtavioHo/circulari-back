import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Throttles by authenticated user id instead of IP, so the limit applies per
 * account (and isn't shared across users behind the same proxy/NAT). Falls back
 * to IP for unauthenticated requests.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    const userId = (req.user as { id?: string } | undefined)?.id;
    return Promise.resolve(userId ?? req.ip);
  }
}
