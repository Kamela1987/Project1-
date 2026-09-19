import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Zone } from '../entities/zone.entity';
import { TownsService } from '../towns/towns.service';
import { CreateZoneDto } from './dto/create-zone.dto';

const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class ZonesService {
  constructor(
    @InjectRepository(Zone) private readonly zones: Repository<Zone>,
    private readonly townsService: TownsService,
  ) {}

  async create(dto: CreateZoneDto): Promise<Zone> {
    if (dto.boundary) {
      this.assertClosedRing(dto.boundary);
    }
    if (dto.townId) {
      await this.townsService.findById(dto.townId); // 404s if the town doesn't exist
    }
    try {
      const zone = this.zones.create({ name: dto.name, townId: dto.townId });
      await this.zones.save(zone);
      if (dto.boundary) {
        const geojson = JSON.stringify({ type: 'Polygon', coordinates: [dto.boundary] });
        await this.zones.manager.query(`UPDATE zones SET boundary = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) WHERE id = $2`, [
          geojson,
          zone.id,
        ]);
      }
      return zone;
    } catch (err) {
      if ((err as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION) {
        throw new ConflictException('A zone with this name already exists');
      }
      throw err;
    }
  }

  findAll(townId?: string): Promise<Zone[]> {
    return this.zones.find({ where: townId ? { townId } : {}, order: { name: 'ASC' } });
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

  /** Which zone (if any) contains this point — used by TripsService's fare estimate. `lng` first, matching GeoJSON/PostGIS order. */
  async findContainingPoint(lat: number, lng: number): Promise<Zone | null> {
    const rows: { id: string; name: string }[] = await this.zones.manager.query(
      `SELECT id, name FROM zones WHERE boundary IS NOT NULL AND ST_Contains(boundary, ST_SetSRID(ST_MakePoint($1, $2), 4326)) LIMIT 1`,
      [lng, lat],
    );
    return rows[0] ? this.zones.create(rows[0]) : null;
  }

  private assertClosedRing(ring: [number, number][]): void {
    const [first] = ring;
    const last = ring[ring.length - 1];
    const isPoint = (p: unknown): p is [number, number] =>
      Array.isArray(p) && p.length === 2 && p.every((n) => typeof n === 'number' && Number.isFinite(n));
    if (!ring.every(isPoint)) {
      throw new BadRequestException('boundary must be an array of [lng, lat] number pairs');
    }
    if (first[0] !== last[0] || first[1] !== last[1]) {
      throw new BadRequestException('boundary must be a closed ring (first and last points equal)');
    }
  }
}
