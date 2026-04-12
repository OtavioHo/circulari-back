import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthRepository } from './auth.repository';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly repository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.repository.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.repository.create({
      email: dto.email,
      name: dto.name,
      password_hash: passwordHash,
    });

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

    const tokens = await this.signTokens(user.id, user.email);
    await this.storeRefreshHash(user.id, tokens.refreshToken);

    return tokens;
  }

  async refresh(userId: string, refreshToken: string) {
    const user = await this.repository.findById(userId);
    if (!user || !user.refresh_token_hash) {
      throw new ForbiddenException('Access denied');
    }

    const tokenValid = await bcrypt.compare(refreshToken, user.refresh_token_hash);
    if (!tokenValid) {
      throw new ForbiddenException('Access denied');
    }

    const tokens = await this.signTokens(user.id, user.email);
    await this.storeRefreshHash(user.id, tokens.refreshToken);

    return tokens;
  }

  async logout(userId: string) {
    await this.repository.updateRefreshTokenHash(userId, null);
  }

  private async signTokens(userId: string, email: string) {
    const payload = { sub: userId, email };

    const [token, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: this.config.get('JWT_EXPIRES_IN', '15m'),
      } as any),
      this.jwtService.signAsync(payload, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      } as any),
    ]);

    return { token, refreshToken };
  }

  private async storeRefreshHash(userId: string, refreshToken: string) {
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.repository.updateRefreshTokenHash(userId, hash);
  }
}
