import 'reflect-metadata';
import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './decorators/public.decorator';
import { JwtRefreshGuard } from './guards/jwt-refresh.guard';

describe('AuthController', () => {
  let controller: AuthController;

  const mockAuthService = {
    register: jest.fn(),
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    getMe: jest.fn(),
    updateProfile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    jest.clearAllMocks();
  });

  describe('register', () => {
    const dto = { email: 'a@b.com', password: 'Pass1!', name: 'Test' };
    const expected = {
      token: 'tok',
      refreshToken: 'ref',
      user: { id: '1', email: 'a@b.com', name: 'Test' },
    };

    it('delegates to authService.register and returns its result', async () => {
      mockAuthService.register.mockResolvedValue(expected);

      const result = await controller.register(dto);

      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(result).toBe(expected);
    });

    it('is marked @Public so it bypasses JwtAuthGuard', () => {
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.register);
      expect(isPublic).toBe(true);
    });
  });

  describe('login', () => {
    const dto = { email: 'a@b.com', password: 'Pass1!' };
    const expected = { token: 'tok', refreshToken: 'ref' };

    it('delegates to authService.login and returns its result', async () => {
      mockAuthService.login.mockResolvedValue(expected);

      const result = await controller.login(dto);

      expect(mockAuthService.login).toHaveBeenCalledWith(dto);
      expect(result).toBe(expected);
    });

    it('is marked @Public so it bypasses JwtAuthGuard', () => {
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.login);
      expect(isPublic).toBe(true);
    });
  });

  describe('refresh', () => {
    it('extracts id and refreshToken from req.user and delegates to authService.refresh', async () => {
      const req = { user: { id: 'uid-1', refreshToken: 'old-tok' } } as any;
      const expected = { token: 'new-tok', refreshToken: 'new-ref' };
      mockAuthService.refresh.mockResolvedValue(expected);

      const result = await controller.refresh(req);

      expect(mockAuthService.refresh).toHaveBeenCalledWith('uid-1', 'old-tok');
      expect(result).toBe(expected);
    });

    it('is marked @Public (JwtRefreshGuard handles auth instead of JwtAuthGuard)', () => {
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.refresh);
      expect(isPublic).toBe(true);
    });

    it('has @UseGuards(JwtRefreshGuard) applied', () => {
      const guards: unknown[] =
        Reflect.getMetadata(GUARDS_METADATA, AuthController.prototype.refresh) ?? [];
      expect(guards).toContain(JwtRefreshGuard);
    });
  });

  describe('logout', () => {
    it('extracts id from req.user, calls authService.logout, and returns a message', async () => {
      const req = { user: { id: 'uid-1' } } as any;
      mockAuthService.logout.mockResolvedValue(undefined);

      const result = await controller.logout(req);

      expect(mockAuthService.logout).toHaveBeenCalledWith('uid-1');
      expect(result).toEqual({ message: 'Logged out' });
    });

    it('is NOT marked @Public so JwtAuthGuard protects it', () => {
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.logout);
      expect(isPublic).toBeUndefined();
    });
  });

  describe('updateMe', () => {
    it('extracts id from req.user and delegates to authService.updateProfile', async () => {
      const req = { user: { id: 'uid-1' } } as any;
      const dto = { name: 'New Name' };
      const expected = { id: 'uid-1', email: 'a@b.com', name: 'New Name' };
      mockAuthService.updateProfile.mockResolvedValue(expected);

      const result = await controller.updateMe(dto, req);

      expect(mockAuthService.updateProfile).toHaveBeenCalledWith('uid-1', dto);
      expect(result).toBe(expected);
    });

    it('is NOT marked @Public so JwtAuthGuard protects it', () => {
      const isPublic = Reflect.getMetadata(IS_PUBLIC_KEY, AuthController.prototype.updateMe);
      expect(isPublic).toBeUndefined();
    });
  });
});
