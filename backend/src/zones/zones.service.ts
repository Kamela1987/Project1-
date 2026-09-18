import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Zone } from '../entities/zone.entity';
import { CreateZoneDto } from './dto/create-zone.dto';

const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class ZonesService {
  constructor(@InjectRepository(Zone) private readonly zones: Repository<Zone>) {}

  async create(dto: CreateZoneDto): Promise<Zone> {
    try {
      return await this.zones.save(this.zones.create(dto));
    } catch (err) {
      if ((err as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION) {
        throw new ConflictException('A zone with this name already exists');
      }
      throw err;
    }
  }

  findAll(): Promise<Zone[]> {
    return this.zones.find({ order: { name: 'ASC' } });
  }

  async findById(id: string): Promise<Zone> {
    const zone = await this.zones.findOneBy({ id });
    if (!zone) {
      throw new NotFoundException('Zone not found');
    }
    return zone;
  }

  async delete(id: string): Promise<void> {
    const result = await this.zones.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Zone not found');
    }
  }
}
