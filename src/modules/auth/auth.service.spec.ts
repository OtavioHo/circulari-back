import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { RevenueCatService } from '../revenuecat/revenuecat.service';
import { EMAIL_SERVICE } from '../email/email.constants';

describe('AuthService', () => {
  let service: AuthService;
  let repository: jest.Mocked<AuthRepository>;
  let revenueCat: { reconcileUser: jest.Mock };
  let emailService: { sendEmail: jest.Mock };

  beforeEach(async () => {
    revenueCat = { reconcileUser: jest.fn().mockResolvedValue(undefined) };
    emailService = { sendEmail: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: AuthRepository,
          useValue: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            updateRefreshTokenHash: jest.fn(),
            verifyAndRotateRefreshToken: jest.fn(),
            findByEmailWithResetFields: jest.fn(),
            storeOtp: jest.fn(),
            clearOtpStoreResetToken: jest.fn(),
            updatePasswordAndClearReset: jest.fn(),
          },
        },
        {
          provide: EMAIL_SERVICE,
          useValue: emailService,
        },
        {
          provide: RevenueCatService,
          useValue: revenueCat,
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn().mockResolvedValue('signed-token'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              const map: Record<string, string> = {
                JWT_SECRET: 'test-secret',
                JWT_EXPIRES_IN: '15m',
                JWT_REFRESH_SECRET: 'test-refresh-secret',
                JWT_REFRESH_EXPIRES_IN: '7d',
              };
              return map[key] ?? defaultValue;
            }),
            getOrThrow: jest.fn((key: string) => {
              const map: Record<string, string> = {
                JWT_SECRET: 'test-secret',
                JWT_REFRESH_SECRET: 'test-refresh-secret',
              };
              if (!map[key]) throw new Error(`Config key "${key}" not found`);
              return map[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    repository = module.get(AuthRepository);
  });

  describe('register', () => {
    const dto = { email: 'test@example.com', password: 'Password1!', name: 'Test' };

    it('should register a new user and return tokens', async () => {
      repository.findByEmail.mockResolvedValue(null);
      repository.create.mockResolvedValue({
        id: 'uuid-1',
        email: dto.email,
        name: dto.name,
        password_hash: 'hashed',
        photo_url: null,
        oauth_provider: null,
        oauth_id: null,
        refresh_token_hash: null,
        tier: 'free',
        tier_event_at: null,
        created_at: new Date(),
        password_reset_otp_hash: null,
        password_reset_otp_expires_at: null,
        password_reset_token_hash: null,
        password_reset_token_expires_at: null,
      });
      repository.updateRefreshTokenHash.mockResolvedValue(undefined as any);

      const result = await service.register(dto);

      expect(result.token).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
      expect(result.user.email).toBe(dto.email);
      expect(result.user.name).toBe(dto.name);
      expect(repository.create).toHaveBeenCalled();
    });

    it('should throw ConflictException for duplicate email', async () => {
      repository.findByEmail.mockResolvedValue({
        id: 'uuid-1',
        email: dto.email,
        name: 'Existing',
        password_hash: 'hashed',
        photo_url: null,
        oauth_provider: null,
        oauth_id: null,
        refresh_token_hash: null,
        tier: 'free',
        created_at: new Date(),
      } as any);

      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    const dto = { email: 'test@example.com', password: 'Password1!' };

    it('should return tokens for valid credentials', async () => {
      const hash = await bcrypt.hash(dto.password, 10);
      repository.findByEmail.mockResolvedValue({
        id: 'uuid-1',
        email: dto.email,
        name: 'Test',
        password_hash: hash,
        photo_url: null,
        oauth_provider: null,
        oauth_id: null,
        refresh_token_hash: null,
        tier: 'free',
        created_at: new Date(),
      } as any);
      repository.updateRefreshTokenHash.mockResolvedValue(undefined as any);

      const result = await service.login(dto);

      expect(result.token).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
      expect(revenueCat.reconcileUser).toHaveBeenCalledWith('uuid-1');
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      const hash = await bcrypt.hash('DifferentPass1!', 10);
      repository.findByEmail.mockResolvedValue({
        id: 'uuid-1',
        email: dto.email,
        name: 'Test',
        password_hash: hash,
        photo_url: null,
        oauth_provider: null,
        oauth_id: null,
        refresh_token_hash: null,
        tier: 'free',
        created_at: new Date(),
      } as any);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for unknown email', async () => {
      repository.findByEmail.mockResolvedValue(null);

      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    const baseUser = {
      id: 'uuid-1',
      email: 'test@example.com',
      name: 'Test',
      password_hash: 'hashed',
      photo_url: null,
      oauth_provider: null,
      oauth_id: null,
      refresh_token_hash: 'some-hash',
      tier: 'free',
      created_at: new Date(),
    } as any;

    it('should rotate tokens for valid refresh token', async () => {
      repository.findById.mockResolvedValue(baseUser);
      repository.verifyAndRotateRefreshToken.mockResolvedValue(true);

      const result = await service.refresh('uuid-1', 'valid-refresh-token');

      expect(result.token).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
      expect(repository.verifyAndRotateRefreshToken).toHaveBeenCalled();
    });

    it('should throw ForbiddenException when token is invalid or already rotated', async () => {
      repository.findById.mockResolvedValue(baseUser);
      repository.verifyAndRotateRefreshToken.mockResolvedValue(false);

      await expect(service.refresh('uuid-1', 'tampered-token')).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException when user does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.refresh('uuid-1', 'some-token')).rejects.toThrow(ForbiddenException);
      expect(repository.verifyAndRotateRefreshToken).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should clear refresh token hash', async () => {
      repository.updateRefreshTokenHash.mockResolvedValue(undefined as any);

      await service.logout('uuid-1');

      expect(repository.updateRefreshTokenHash).toHaveBeenCalledWith('uuid-1', null);
    });

    it('should be idempotent (second call does not throw)', async () => {
      repository.updateRefreshTokenHash.mockResolvedValue(undefined as any);

      await service.logout('uuid-1');
      await service.logout('uuid-1');

      expect(repository.updateRefreshTokenHash).toHaveBeenCalledTimes(2);
    });
  });

  describe('forgotPassword', () => {
    const email = 'test@example.com';
    const baseResetUser = {
      id: 'uuid-1',
      email,
      password_reset_otp_hash: null,
      password_reset_otp_expires_at: null,
      password_reset_token_hash: null,
      password_reset_token_expires_at: null,
    };

    it('should silently return when user not found', async () => {
      repository.findByEmailWithResetFields.mockResolvedValue(null);

      await expect(service.forgotPassword(email)).resolves.toBeUndefined();
      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it('should store OTP hash and send email when user exists', async () => {
      repository.findByEmailWithResetFields.mockResolvedValue(baseResetUser);
      repository.storeOtp.mockResolvedValue(true as any);

      await service.forgotPassword(email);

      expect(repository.storeOtp).toHaveBeenCalledWith(
        'uuid-1',
        expect.any(String),
        expect.any(Date),
        expect.any(Date),
      );
      expect(emailService.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: email }));
    });

    it('should silently return when called too soon after a previous request', async () => {
      const futureExpiry = new Date(Date.now() + 9.5 * 60 * 1000);
      repository.findByEmailWithResetFields.mockResolvedValue({
        ...baseResetUser,
        password_reset_otp_hash: 'some-hash',
        password_reset_otp_expires_at: futureExpiry,
      });

      await expect(service.forgotPassword(email)).resolves.toBeUndefined();
      expect(repository.storeOtp).not.toHaveBeenCalled();
      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });

    it('should swallow email send errors and still resolve (prevents account enumeration)', async () => {
      repository.findByEmailWithResetFields.mockResolvedValue(baseResetUser);
      repository.storeOtp.mockResolvedValue(true as any);
      emailService.sendEmail.mockRejectedValue(new Error('SMTP failure'));

      await expect(service.forgotPassword(email)).resolves.toBeUndefined();
    });
  });

  describe('verifyResetOtp', () => {
    const email = 'test@example.com';

    it('should return reset token when OTP is correct and not expired', async () => {
      const otp = '123456';
      const otpHash = await bcrypt.hash(otp, 10);
      repository.findByEmailWithResetFields.mockResolvedValue({
        id: 'uuid-1',
        email,
        password_reset_otp_hash: otpHash,
        password_reset_otp_expires_at: new Date(Date.now() + 5 * 60 * 1000),
        password_reset_token_hash: null,
        password_reset_token_expires_at: null,
      });
      repository.clearOtpStoreResetToken.mockResolvedValue(true as any);

      const result = await service.verifyResetOtp(email, otp);

      expect(result.resetToken).toBeDefined();
      expect(result.resetToken).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('should throw UnauthorizedException for wrong OTP', async () => {
      const otpHash = await bcrypt.hash('999999', 10);
      repository.findByEmailWithResetFields.mockResolvedValue({
        id: 'uuid-1',
        email,
        password_reset_otp_hash: otpHash,
        password_reset_otp_expires_at: new Date(Date.now() + 5 * 60 * 1000),
        password_reset_token_hash: null,
        password_reset_token_expires_at: null,
      });

      await expect(service.verifyResetOtp(email, '000000')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for expired OTP', async () => {
      const otp = '123456';
      const otpHash = await bcrypt.hash(otp, 10);
      repository.findByEmailWithResetFields.mockResolvedValue({
        id: 'uuid-1',
        email,
        password_reset_otp_hash: otpHash,
        password_reset_otp_expires_at: new Date(Date.now() - 1000),
        password_reset_token_hash: null,
        password_reset_token_expires_at: null,
      });

      await expect(service.verifyResetOtp(email, otp)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      repository.findByEmailWithResetFields.mockResolvedValue(null);

      await expect(service.verifyResetOtp(email, '123456')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('resetPassword', () => {
    const email = 'test@example.com';

    it('should update password and clear reset fields for valid token', async () => {
      const token = randomUUID();
      const tokenHash = await bcrypt.hash(token, 10);
      repository.findByEmailWithResetFields.mockResolvedValue({
        id: 'uuid-1',
        email,
        password_reset_otp_hash: null,
        password_reset_otp_expires_at: null,
        password_reset_token_hash: tokenHash,
        password_reset_token_expires_at: new Date(Date.now() + 5 * 60 * 1000),
      });
      repository.updatePasswordAndClearReset.mockResolvedValue(true as any);

      await service.resetPassword(email, token, 'NewPass1!');

      expect(repository.updatePasswordAndClearReset).toHaveBeenCalledWith(
        'uuid-1',
        expect.any(String),
        expect.any(String),
      );
    });

    it('should throw UnauthorizedException for invalid reset token', async () => {
      const tokenHash = await bcrypt.hash('correct-token', 10);
      repository.findByEmailWithResetFields.mockResolvedValue({
        id: 'uuid-1',
        email,
        password_reset_otp_hash: null,
        password_reset_otp_expires_at: null,
        password_reset_token_hash: tokenHash,
        password_reset_token_expires_at: new Date(Date.now() + 5 * 60 * 1000),
      });

      await expect(service.resetPassword(email, randomUUID(), 'NewPass1!')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for expired reset token', async () => {
      const token = randomUUID();
      const tokenHash = await bcrypt.hash(token, 10);
      repository.findByEmailWithResetFields.mockResolvedValue({
        id: 'uuid-1',
        email,
        password_reset_otp_hash: null,
        password_reset_otp_expires_at: null,
        password_reset_token_hash: tokenHash,
        password_reset_token_expires_at: new Date(Date.now() - 1000),
      });

      await expect(service.resetPassword(email, token, 'NewPass1!')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user not found', async () => {
      repository.findByEmailWithResetFields.mockResolvedValue(null);

      await expect(service.resetPassword(email, randomUUID(), 'NewPass1!')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
