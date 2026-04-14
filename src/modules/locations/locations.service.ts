import { Injectable, NotFoundException } from '@nestjs/common';
import { LocationsRepository } from './locations.repository';

@Injectable()
export class LocationsService {
  constructor(private readonly repository: LocationsRepository) {}

  search(userId: string, query?: string) {
    return this.repository.search(userId, query);
  }

  create(userId: string, name: string) {
    return this.repository.create(userId, name);
  }

  async update(id: string, userId: string, name: string) {
    const location = await this.repository.update(id, userId, name);
    if (!location) {
      throw new NotFoundException('Location not found');
    }
    return location;
  }

  async remove(id: string, userId: string) {
    const count = await this.repository.delete(id, userId);
    if (count === 0) {
      throw new NotFoundException('Location not found');
    }
  }
}
