import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomInt, randomUUID } from 'crypto';
import type { StringValue } from 'ms';
import { Prisma } from '../../generated/prisma/client';
import { AuthRepository } from './auth.repository';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RevenueCatService } from '../revenuecat/revenuecat.service';
import { EMAIL_SERVICE } from '../email/email.constants';
import { IEmailService } from '../email/email.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly repository: AuthRepository,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly revenueCat: RevenueCatService,
    @Inject(EMAIL_SERVICE) private readonly emailService: IEmailService,
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

  async getMe(userId: string) {
    const user = await this.repository.findById(userId);
    if (!user) throw new ForbiddenException('User not found');
    return { id: user.id, email: user.email, name: user.name };
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

    void this.revenueCat.reconcileUser(user.id).catch((err) => {
      this.logger.warn(
        `Background tier reconcile failed for ${user.id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    });

    const tokens = await this.signTokens(user.id, user.email);
    await this.storeRefreshHash(user.id, tokens.refreshToken);

    return {
      token: tokens.token,
      refreshToken: tokens.refreshToken,
      user: { id: user.id, email: user.email, name: user.name },
    };
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

  async forgotPassword(email: string): Promise<void> {
    const user = await this.repository.findByEmailWithResetFields(email);
    if (!user) return;

    const now = new Date();
    const rateLimitCutoff = new Date(now.getTime() + 9 * 60 * 1000);

    // cheap pre-check before the expensive bcrypt hash
    if (
      user.password_reset_otp_expires_at &&
      user.password_reset_otp_expires_at > rateLimitCutoff
    ) {
      return;
    }

    const otp = randomInt(100000, 1000000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

    const stored = await this.repository.storeOtp(user.id, otpHash, expiresAt, rateLimitCutoff);
    if (!stored) return;

    try {
      await this.emailService.sendEmail({
        to: email,
        subject: 'Your password reset code',
        html: `<p>Your password reset code is: <strong>${otp}</strong></p><p>This code expires in 10 minutes.</p>`,
        text: `Your password reset code is: ${otp}\n\nThis code expires in 10 minutes.`,
      });
    } catch (error) {
      this.logger.error(
        `Failed to send password reset email for user ${user.id}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  async verifyResetOtp(email: string, otp: string): Promise<{ resetToken: string }> {
    const user = await this.repository.findByEmailWithResetFields(email);
    if (!user || !user.password_reset_otp_hash) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const now = new Date();
    if (!user.password_reset_otp_expires_at || user.password_reset_otp_expires_at < now) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const valid = await bcrypt.compare(otp, user.password_reset_otp_hash);
    if (!valid) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    const resetToken = randomUUID();
    const tokenHash = await bcrypt.hash(resetToken, 10);
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);

    const consumed = await this.repository.clearOtpStoreResetToken(
      user.id,
      user.password_reset_otp_hash,
      tokenHash,
      expiresAt,
    );
    if (!consumed) {
      throw new UnauthorizedException('Invalid or expired code');
    }

    return { resetToken };
  }

  async resetPassword(email: string, resetToken: string, newPassword: string): Promise<void> {
    const user = await this.repository.findByEmailWithResetFields(email);
    if (!user || !user.password_reset_token_hash) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const now = new Date();
    if (!user.password_reset_token_expires_at || user.password_reset_token_expires_at < now) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const valid = await bcrypt.compare(resetToken, user.password_reset_token_hash);
    if (!valid) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const updated = await this.repository.updatePasswordAndClearReset(
      user.id,
      user.password_reset_token_hash,
      passwordHash,
    );
    if (!updated) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }
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
