import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FareRule } from '../entities/fare-rule.entity';
import { ZonesService } from '../zones/zones.service';
import { CreateFareRuleDto } from './dto/create-fare-rule.dto';

const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class FareRulesService {
  constructor(
    @InjectRepository(FareRule) private readonly fareRules: Repository<FareRule>,
    private readonly zonesService: ZonesService,
  ) {}

  async create(zoneId: string, dto: CreateFareRuleDto): Promise<FareRule> {
    await this.zonesService.findById(zoneId); // 404s if the zone doesn't exist
    try {
      return await this.fareRules.save(
        this.fareRules.create({
          zoneId,
          vehicleType: dto.vehicleType,
          baseFare: dto.baseFare.toFixed(2),
          perKmRate: dto.perKmRate.toFixed(2),
          perMinRate: dto.perMinRate.toFixed(2),
        }),
      );
    } catch (err) {
      if ((err as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION) {
        throw new ConflictException('A fare rule for this zone and vehicle type already exists');
      }
      throw err;
    }
  }

  findByZone(zoneId: string): Promise<FareRule[]> {
    return this.fareRules.find({ where: { zoneId } });
  }

  async delete(id: string): Promise<void> {
    const result = await this.fareRules.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Fare rule not found');
    }
  }
}
