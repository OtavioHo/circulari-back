import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { StringValue } from 'ms';
import { Prisma } from '../../generated/prisma/client';
import { AuthRepository } from './auth.repository';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RevenueCatService } from '../revenuecat/revenuecat.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly revenueCat: RevenueCatService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.repository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    let user: Awaited<ReturnType<typeof this.repository.create>>;
    try {
      user = await this.repository.create({
        email: dto.email,
        name: dto.name,
        password_hash: passwordHash,
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException('Email already in use');
      }
      throw err;
    }

    const tokens = await this.signTokens(user.id, user.email);
    await this.storeRefreshHash(user.id, tokens.refreshToken);

    return {
      token: tokens.token,
      refreshToken: tokens.refreshToken,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.repository.findByEmail(dto.email);
    if (!user || !user.password_hash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    void this.revenueCat.reconcileUser(user.id).catch(() => undefined);

    const tokens = await this.signTokens(user.id, user.email);
    await this.storeRefreshHash(user.id, tokens.refreshToken);

    return tokens;
  }

  async refresh(userId: string, refreshToken: string) {
    const user = await this.repository.findById(userId);
    if (!user) {
      throw new ForbiddenException('Access denied');
    }

    const tokens = await this.signTokens(user.id, user.email);
    const newHash = await bcrypt.hash(tokens.refreshToken, 10);

    const rotated = await this.repository.verifyAndRotateRefreshToken(
      userId,
      (hash) => bcrypt.compare(refreshToken, hash),
      newHash,
    );

    if (!rotated) {
      throw new ForbiddenException('Access denied');
    }

    return tokens;
  }

  async logout(userId: string) {
    await this.repository.updateRefreshTokenHash(userId, null);
  }

  private async signTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const [token, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRES_IN', '15m') as StringValue,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d') as StringValue,
      }),
    ]);

    return { token, refreshToken };
  }

  private async storeRefreshHash(userId: string, refreshToken: string) {
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.repository.updateRefreshTokenHash(userId, hash);
  }
}
