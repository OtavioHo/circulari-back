import { Injectable } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(data: { email: string; name: string; password_hash: string }) {
    return this.prisma.user.create({ data });
  }

  async updateRefreshTokenHash(userId: string, hash: string | null) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { refresh_token_hash: hash },
    });
  }

  async findByEmailWithResetFields(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password_reset_otp_hash: true,
        password_reset_otp_expires_at: true,
        password_reset_token_hash: true,
        password_reset_token_expires_at: true,
      },
    });
  }

  async storeOtp(
    userId: string,
    otpHash: string,
    expiresAt: Date,
    rateLimitCutoff: Date,
  ): Promise<boolean> {
    const result = await this.prisma.user.updateMany({
      where: {
        id: userId,
        OR: [
          { password_reset_otp_expires_at: null },
          { password_reset_otp_expires_at: { lte: rateLimitCutoff } },
        ],
      },
      data: {
        password_reset_otp_hash: otpHash,
        password_reset_otp_expires_at: expiresAt,
        password_reset_token_hash: null,
        password_reset_token_expires_at: null,
      },
    });
    return result.count === 1;
  }

  async clearOtpStoreResetToken(
    userId: string,
    currentOtpHash: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<boolean> {
    const result = await this.prisma.user.updateMany({
      where: { id: userId, password_reset_otp_hash: currentOtpHash },
      data: {
        password_reset_otp_hash: null,
        password_reset_otp_expires_at: null,
        password_reset_token_hash: tokenHash,
        password_reset_token_expires_at: expiresAt,
      },
    });
    return result.count === 1;
  }

  async updatePasswordAndClearReset(
    userId: string,
    currentTokenHash: string,
    passwordHash: string,
  ): Promise<boolean> {
    const result = await this.prisma.user.updateMany({
      where: { id: userId, password_reset_token_hash: currentTokenHash },
      data: {
        password_hash: passwordHash,
        password_reset_otp_hash: null,
        password_reset_otp_expires_at: null,
        password_reset_token_hash: null,
        password_reset_token_expires_at: null,
      },
    });
    return result.count === 1;
  }

  /**
   * Atomically verifies the current refresh token hash and, if valid, replaces it
   * with a new hash. Uses SELECT FOR UPDATE to lock the row so concurrent requests
   * with the same old token cannot both succeed.
   *
   * @returns true if the token was valid and the hash was rotated, false otherwise.
   */
  async verifyAndRotateRefreshToken(
    userId: string,
    verify: (hash: string) => Promise<boolean>,
    newHash: string,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ refresh_token_hash: string | null }>>(
        Prisma.sql`SELECT refresh_token_hash FROM users WHERE id = ${userId}::uuid FOR UPDATE`,
      );
      const row = rows[0];
      if (!row?.refresh_token_hash) return false;

      const valid = await verify(row.refresh_token_hash);
      if (!valid) return false;

      await tx.user.update({
        where: { id: userId },
        data: { refresh_token_hash: newHash },
      });
      return true;
    });
  }
}
