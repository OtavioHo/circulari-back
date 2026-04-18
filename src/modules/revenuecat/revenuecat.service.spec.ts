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
              if (key === 'REVENUECAT_API_URL') return fallback;
              return fallback;
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

    it('sets tier to premium for INITIAL_PURCHASE', async () => {
      repository.processEvent.mockResolvedValue({ duplicate: false, userUpdated: true });

      await service.handleWebhook({
        event: { id: 'evt-1', type: 'INITIAL_PURCHASE', app_user_id: 'user-1' },
      });

      expect(repository.processEvent).toHaveBeenCalledWith('evt-1', 'user-1', 'premium');
    });

    it('sets tier to free for EXPIRATION', async () => {
      repository.processEvent.mockResolvedValue({ duplicate: false, userUpdated: true });

      await service.handleWebhook({
        event: { id: 'evt-2', type: 'EXPIRATION', app_user_id: 'user-1' },
      });

      expect(repository.processEvent).toHaveBeenCalledWith('evt-2', 'user-1', 'free');
    });

    it('is idempotent when repository reports a duplicate event', async () => {
      repository.processEvent.mockResolvedValue({ duplicate: true, userUpdated: false });

      await expect(
        service.handleWebhook({
          event: { id: 'evt-dup', type: 'INITIAL_PURCHASE', app_user_id: 'user-1' },
        }),
      ).resolves.toBeUndefined();
    });

    it('records event but does not update tier for ignored event types', async () => {
      repository.processEvent.mockResolvedValue({ duplicate: false, userUpdated: false });

      await service.handleWebhook({
        event: { id: 'evt-3', type: 'CANCELLATION', app_user_id: 'user-1' },
      });

      expect(repository.processEvent).toHaveBeenCalledWith('evt-3', 'user-1', null);
    });

    it('falls back to original_app_user_id when app_user_id is not present', async () => {
      repository.processEvent.mockResolvedValue({ duplicate: false, userUpdated: true });

      await service.handleWebhook({
        event: {
          id: 'evt-4',
          type: 'RENEWAL',
          original_app_user_id: 'user-orig',
        },
      });

      expect(repository.processEvent).toHaveBeenCalledWith('evt-4', 'user-orig', 'premium');
    });
  });

  describe('reconcileUser', () => {
    const originalFetch = global.fetch;

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('sets tier to premium when subscriber has an unexpired entitlement', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          subscriber: {
            entitlements: {
              premium: { expires_date: new Date(Date.now() + 60_000).toISOString() },
            },
          },
        }),
      }) as any;

      await service.reconcileUser('user-1');

      expect(repository.updateUserTier).toHaveBeenCalledWith('user-1', 'premium');
    });

    it('sets tier to premium when entitlement has no expires_date (lifetime)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          subscriber: { entitlements: { premium: { expires_date: null } } },
        }),
      }) as any;

      await service.reconcileUser('user-1');

      expect(repository.updateUserTier).toHaveBeenCalledWith('user-1', 'premium');
    });

    it('sets tier to free when entitlements are empty', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ subscriber: { entitlements: {} } }),
      }) as any;

      await service.reconcileUser('user-1');

      expect(repository.updateUserTier).toHaveBeenCalledWith('user-1', 'free');
    });

    it('sets tier to free when the only entitlement has expired', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          subscriber: {
            entitlements: {
              premium: { expires_date: new Date(Date.now() - 60_000).toISOString() },
            },
          },
        }),
      }) as any;

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

    it('does not downgrade the user when the subscriber payload is malformed', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ subscriber: 'unexpected' }),
      }) as any;

      await service.reconcileUser('user-1');

      expect(repository.updateUserTier).not.toHaveBeenCalled();
    });

    it('does not downgrade the user when an entitlement has a malformed expires_date', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          subscriber: { entitlements: { premium: { expires_date: 12345 } } },
        }),
      }) as any;

      await service.reconcileUser('user-1');

      expect(repository.updateUserTier).not.toHaveBeenCalled();
    });
  });
});
