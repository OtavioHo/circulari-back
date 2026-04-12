import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';

describe('AuthService', () => {
  let service: AuthService;
  let repository: jest.Mocked<AuthRepository>;

  beforeEach(async () => {
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
          },
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
        created_at: new Date(),
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
        created_at: new Date(),
      });

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
        created_at: new Date(),
      });
      repository.updateRefreshTokenHash.mockResolvedValue(undefined as any);

      const result = await service.login(dto);

      expect(result.token).toBe('signed-token');
      expect(result.refreshToken).toBe('signed-token');
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
        created_at: new Date(),
      });

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
      created_at: new Date(),
    };

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
});
