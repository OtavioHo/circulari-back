import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ListsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllByUser(userId: string) {
    return this.prisma.list.findMany({
      where: { user_id: userId },
      include: {
        _count: { select: { items: true } },
        items: { select: { user_defined_value: true } },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  create(userId: string, name: string) {
    return this.prisma.list.create({
      data: { user_id: userId, name },
    });
  }

  findOneByUser(id: string, userId: string) {
    return this.prisma.list.findFirst({ where: { id, user_id: userId } });
  }

  async update(id: string, userId: string, name: string) {
    const result = await this.prisma.list.updateMany({
      where: { id, user_id: userId },
      data: { name },
    });
    return result.count;
  }

  async delete(id: string, userId: string) {
    const result = await this.prisma.list.deleteMany({
      where: { id, user_id: userId },
    });
    return result.count;
  }
}
