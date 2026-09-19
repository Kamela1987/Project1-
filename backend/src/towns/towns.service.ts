import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Town } from '../entities/town.entity';
import { CreateTownDto } from './dto/create-town.dto';

const POSTGRES_UNIQUE_VIOLATION = '23505';

/** Near-identical to ZonesService — same PostGIS boundary/point-in-polygon shape, one level up the geographic hierarchy. See Town's entity comment for why these aren't unified into one. */
@Injectable()
export class TownsService {
  constructor(@InjectRepository(Town) private readonly towns: Repository<Town>) {}

  async create(dto: CreateTownDto): Promise<Town> {
    if (dto.boundary) {
      this.assertClosedRing(dto.boundary);
    }
    try {
      const town = this.towns.create({ name: dto.name });
      await this.towns.save(town);
      if (dto.boundary) {
        const geojson = JSON.stringify({ type: 'Polygon', coordinates: [dto.boundary] });
        await this.towns.manager.query(`UPDATE towns SET boundary = ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) WHERE id = $2`, [
          geojson,
          town.id,
        ]);
      }
      return town;
    } catch (err) {
      if ((err as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION) {
        throw new ConflictException('A town with this name already exists');
      }
      throw err;
    }
  }

  findAll(): Promise<Town[]> {
    return this.towns.find({ order: { name: 'ASC' } });
  }

  async findById(id: string): Promise<Town> {
    const town = await this.towns.findOneBy({ id });
    if (!town) {
      throw new NotFoundException('Town not found');
    }
    return town;
  }

  async delete(id: string): Promise<void> {
    const result = await this.towns.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('Town not found');
    }
  }

  /** Which town (if any) contains this point — used by TripsService for both trip-town tagging and driver-matching scoping, and by ZonesService for a zone's optional townId. `lng` first, matching GeoJSON/PostGIS order. */
  async findContainingPoint(lat: number, lng: number): Promise<Town | null> {
    const rows: { id: string; name: string }[] = await this.towns.manager.query(
      `SELECT id, name FROM towns WHERE boundary IS NOT NULL AND ST_Contains(boundary, ST_SetSRID(ST_MakePoint($1, $2), 4326)) LIMIT 1`,
      [lng, lat],
    );
    return rows[0] ? this.towns.create(rows[0]) : null;
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
