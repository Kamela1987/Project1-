import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { User } from '../entities/user.entity';

@Injectable()
export class UsersService {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}

  async findById(id: string): Promise<User> {
    const user = await this.users.findOneBy({ id });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /** Bulk lookup for enriching another entity's list of foreign user ids (e.g. AuditService's actorUserId) without an N+1. */
  findByIds(ids: string[]): Promise<User[]> {
    if (!ids.length) {
      return Promise.resolve([]);
    }
    return this.users.findBy({ id: In(ids) });
  }
}
