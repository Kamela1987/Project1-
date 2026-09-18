import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Rating } from '../entities/rating.entity';
import { CreateRatingDto } from './dto/create-rating.dto';

export interface DriverRatingAggregate {
  average: number | null;
  count: number;
}

const POSTGRES_UNIQUE_VIOLATION = '23505';

/**
 * Deliberately has no cross-module dependencies — tripId/riderId/driverId
 * are passed in by the caller (TripsController/DriversController), which
 * already has Trip/Driver state loaded. Keeps this a leaf module that
 * TripsModule and DriversModule can both import without any circularity.
 */
@Injectable()
export class RatingsService {
  constructor(@InjectRepository(Rating) private readonly ratings: Repository<Rating>) {}

  async submit(
    tripId: string,
    riderId: string,
    driverId: string,
    dto: CreateRatingDto,
  ): Promise<Rating> {
    try {
      const rating = this.ratings.create({ tripId, riderId, driverId, ...dto });
      return await this.ratings.save(rating);
    } catch (err) {
      if ((err as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION) {
        throw new ConflictException('Trip already rated');
      }
      throw err;
    }
  }

  async findByTripId(tripId: string): Promise<Rating | null> {
    return this.ratings.findOneBy({ tripId });
  }

  async getDriverAggregate(driverId: string): Promise<DriverRatingAggregate> {
    const result = await this.ratings
      .createQueryBuilder('r')
      .select('AVG(r.stars)', 'average')
      .addSelect('COUNT(*)', 'count')
      .where('r.driverId = :driverId', { driverId })
      .getRawOne<{ average: string | null; count: string }>();

    return {
      average: result?.average == null ? null : Math.round(Number(result.average) * 10) / 10,
      count: Number(result?.count ?? 0),
    };
  }
}
