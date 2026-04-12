import { Injectable } from '@nestjs/common';
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
}
