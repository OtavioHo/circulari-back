import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LocationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  search(userId: string, query?: string) {
    return this.prisma.location.findMany({
      where: {
        user_id: userId,
        ...(query ? { name: { contains: query, mode: 'insensitive' } } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  create(userId: string, name: string) {
    return this.prisma.location.create({
      data: { user_id: userId, name },
    });
  }

  async update(id: string, userId: string, name: string) {
    const result = await this.prisma.location.updateMany({
      where: { id, user_id: userId },
      data: { name },
    });
    return result.count;
  }

  async delete(id: string, userId: string) {
    const result = await this.prisma.location.deleteMany({
      where: { id, user_id: userId },
    });
    return result.count;
  }
}
