import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RevenueCatService } from './revenuecat.service';
import { RevenueCatRepository } from './revenuecat.repository';

describe('RevenueCatService', () => {
  let service: RevenueCatService;
  let repository: jest.Mocked<RevenueCatRepository>;

  const WEBHOOK_SECRET = 'test-secret';
  const API_KEY = 'test-api-key';
  // app_user_id must be a UUID (set via Purchases.logIn) for a tier change to apply.
  const USER = '11111111-1111-1111-1111-111111111111';

  const processed = (
    over: Partial<{ duplicate: boolean; stale: boolean; userUpdated: boolean }>,
  ) => ({
    duplicate: false,
    stale: false,
    userUpdated: false,
    ...over,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RevenueCatService,
        {
          provide: RevenueCatRepository,
          useValue: {
            updateUserTier: jest.fn(),
            processEvent: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: unknown) => {
              if (key === 'REVENUECAT_WEBHOOK_SECRET') return WEBHOOK_SECRET;
              if (key === 'REVENUECAT_API_KEY') return API_KEY;
              return fallback; // API_URL + entitlement ids fall back to defaults
            }),
          },
        },
      ],
    }).compile();

    service = module.get<RevenueCatService>(RevenueCatService);
    repository = module.get(RevenueCatRepository);
  });

  describe('verifySignature', () => {
    it('accepts the configured shared secret', () => {
      expect(() => service.verifySignature(`Bearer ${WEBHOOK_SECRET}`)).not.toThrow();
    });

    it('accepts the secret without the Bearer prefix', () => {
      expect(() => service.verifySignature(WEBHOOK_SECRET)).not.toThrow();
    });

    it('rejects missing authorization header', () => {
      expect(() => service.verifySignature(undefined)).toThrow(UnauthorizedException);
    });

    it('rejects an incorrect secret', () => {
      expect(() => service.verifySignature('Bearer wrong-secret')).toThrow(UnauthorizedException);
    });
  });

  describe('handleWebhook', () => {
    it('throws BadRequest when event id or type is missing', async () => {
      await expect(service.handleWebhook({ event: { type: 'INITIAL_PURCHASE' } })).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.handleWebhook({ event: { id: 'evt-1' } })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequest when app_user_id is missing', async () => {
      await expect(
        service.handleWebhook({ event: { id: 'evt-1', type: 'INITIAL_PURCHASE' } }),
      ).rejects.toThrow(BadRequestException);
    });

    it('grants pro for INITIAL_PURCHASE with the pro entitlement', async () => {
      repository.processEvent.mockResolvedValue(processed({ userUpdated: true }));

      await service.handleWebhook({
        event: {
          id: 'evt-1',
          type: 'INITIAL_PURCHASE',
          app_user_id: USER,
          entitlement_ids: ['pro'],
          event_timestamp_ms: 1_700_000_000_000,
        },
      });

      expect(repository.processEvent).toHaveBeenCalledWith(
        'evt-1',
        USER,
        'pro',
        new Date(1_700_000_000_000),
      );
    });

    it('grants essencial for the essencial entitlement', async () => {
      repository.processEvent.mockResolvedValue(processed({ userUpdated: true }));

      await service.handleWebhook({
        event: { id: 'evt-2', type: 'RENEWAL', app_user_id: USER, entitlement_ids: ['essencial'] },
      });

      expect(repository.processEvent).toHaveBeenCalledWith(
        'evt-2',
        USER,
        'essencial',
        expect.any(Date),
      );
    });

    it('pro outranks essencial when both entitlements are present', async () => {
      repository.processEvent.mockResolvedValue(processed({ userUpdated: true }));

      await service.handleWebhook({
        event: {
          id: 'evt-3',
          type: 'PRODUCT_CHANGE',
          app_user_id: USER,
          entitlement_ids: ['essencial', 'pro'],
        },
      });

      expect(repository.processEvent).toHaveBeenCalledWith('evt-3', USER, 'pro', expect.any(Date));
    });

    it('does not grant when a granting event carries no entitlement_ids', async () => {
      repository.processEvent.mockResolvedValue(processed({}));

      await service.handleWebhook({
        event: { id: 'evt-4', type: 'INITIAL_PURCHASE', app_user_id: USER, entitlement_ids: [] },
      });

      expect(repository.processEvent).toHaveBeenCalledWith('evt-4', USER, null, expect.any(Date));
    });

    it('honors the grace period: BILLING_ISSUE keeps the entitlement tier', async () => {
      repository.processEvent.mockResolvedValue(processed({ userUpdated: true }));

      await service.handleWebhook({
        event: { id: 'evt-5', type: 'BILLING_ISSUE', app_user_id: USER, entitlement_ids: ['pro'] },
      });

      expect(repository.processEvent).toHaveBeenCalledWith('evt-5', USER, 'pro', expect.any(Date));
    });

    it('sets tier to free for EXPIRATION', async () => {
      repository.processEvent.mockResolvedValue(processed({ userUpdated: true }));

      await service.handleWebhook({
        event: { id: 'evt-6', type: 'EXPIRATION', app_user_id: USER },
      });

      expect(repository.processEvent).toHaveBeenCalledWith('evt-6', USER, 'free', expect.any(Date));
    });

    it('records but does not change tier for ignored event types', async () => {
      repository.processEvent.mockResolvedValue(processed({}));

      await service.handleWebhook({
        event: { id: 'evt-7', type: 'CANCELLATION', app_user_id: USER, entitlement_ids: ['pro'] },
      });

      expect(repository.processEvent).toHaveBeenCalledWith('evt-7', USER, null, expect.any(Date));
    });

    it('does not change tier when app_user_id is not a UUID (anonymous)', async () => {
      repository.processEvent.mockResolvedValue(processed({}));

      await service.handleWebhook({
        event: {
          id: 'evt-8',
          type: 'INITIAL_PURCHASE',
          app_user_id: '$RCAnonymousID:abc123',
          entitlement_ids: ['pro'],
        },
      });

      expect(repository.processEvent).toHaveBeenCalledWith(
        'evt-8',
        '$RCAnonymousID:abc123',
        null,
        expect.any(Date),
      );
    });

    it('is idempotent when repository reports a duplicate event', async () => {
      repository.processEvent.mockResolvedValue(processed({ duplicate: true }));

      await expect(
        service.handleWebhook({
          event: {
            id: 'evt-dup',
            type: 'INITIAL_PURCHASE',
            app_user_id: USER,
            entitlement_ids: ['pro'],
          },
        }),
      ).resolves.toBeUndefined();
    });

    it('ignores stale out-of-order events without throwing', async () => {
      repository.processEvent.mockResolvedValue(processed({ stale: true }));

      await expect(
        service.handleWebhook({
          event: { id: 'evt-stale', type: 'EXPIRATION', app_user_id: USER, event_timestamp_ms: 1 },
        }),
      ).resolves.toBeUndefined();
    });

    it('falls back to original_app_user_id when app_user_id is not present', async () => {
      repository.processEvent.mockResolvedValue(processed({ userUpdated: true }));

      await service.handleWebhook({
        event: {
          id: 'evt-9',
          type: 'RENEWAL',
          original_app_user_id: USER,
          entitlement_ids: ['pro'],
        },
      });

      expect(repository.processEvent).toHaveBeenCalledWith('evt-9', USER, 'pro', expect.any(Date));
    });
  });

  describe('reconcileUser', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    const mockSubscriber = (entitlements: unknown) => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ subscriber: { entitlements } }),
      }) as any;
    };

    it('sets pro when the pro entitlement is active', async () => {
      mockSubscriber({ pro: { expires_date: new Date(Date.now() + 60_000).toISOString() } });
      await service.reconcileUser('user-1');
      expect(repository.updateUserTier).toHaveBeenCalledWith('user-1', 'pro');
    });

    it('sets essencial when only the essencial entitlement is active', async () => {
      mockSubscriber({ essencial: { expires_date: null } });
      await service.reconcileUser('user-1');
      expect(repository.updateUserTier).toHaveBeenCalledWith('user-1', 'essencial');
    });

    it('picks the highest active tier (pro > essencial)', async () => {
      mockSubscriber({
        essencial: { expires_date: null },
        pro: { expires_date: new Date(Date.now() + 60_000).toISOString() },
      });
      await service.reconcileUser('user-1');
      expect(repository.updateUserTier).toHaveBeenCalledWith('user-1', 'pro');
    });

    it('sets free when entitlements are empty', async () => {
      mockSubscriber({});
      await service.reconcileUser('user-1');
      expect(repository.updateUserTier).toHaveBeenCalledWith('user-1', 'free');
    });

    it('sets free when the only entitlement has expired', async () => {
      mockSubscriber({ pro: { expires_date: new Date(Date.now() - 60_000).toISOString() } });
      await service.reconcileUser('user-1');
      expect(repository.updateUserTier).toHaveBeenCalledWith('user-1', 'free');
    });

    it('sets free when only an unrecognized entitlement is active', async () => {
      mockSubscriber({ legacy_thing: { expires_date: null } });
      await service.reconcileUser('user-1');
      expect(repository.updateUserTier).toHaveBeenCalledWith('user-1', 'free');
    });

    it('silently skips when the RevenueCat API returns non-OK', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as any;
      await service.reconcileUser('user-1');
      expect(repository.updateUserTier).not.toHaveBeenCalled();
    });

    it('silently skips when fetch throws', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network error')) as any;
      await service.reconcileUser('user-1');
      expect(repository.updateUserTier).not.toHaveBeenCalled();
    });

    it('does not downgrade when the subscriber payload is malformed', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ subscriber: 'unexpected' }),
      }) as any;
      await service.reconcileUser('user-1');
      expect(repository.updateUserTier).not.toHaveBeenCalled();
    });

    it('does not downgrade when an entitlement has a malformed expires_date', async () => {
      mockSubscriber({ pro: { expires_date: 12345 } });
      await service.reconcileUser('user-1');
      expect(repository.updateUserTier).not.toHaveBeenCalled();
    });
  });
});
