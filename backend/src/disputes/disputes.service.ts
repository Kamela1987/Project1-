import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispute, DisputeStatus } from '../entities/dispute.entity';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';

/**
 * Leaf module (no cross-module deps) — same shape as RatingsService.
 * Whether the caller is actually allowed to raise a dispute on a given
 * trip is Trip-state validation that lives in TripsController, which
 * already has that state loaded.
 */
@Injectable()
export class DisputesService {
  constructor(@InjectRepository(Dispute) private readonly disputes: Repository<Dispute>) {}

  create(tripId: string, raisedByUserId: string, dto: CreateDisputeDto): Promise<Dispute> {
    return this.disputes.save(this.disputes.create({ tripId, raisedByUserId, ...dto }));
  }

  findByTrip(tripId: string): Promise<Dispute[]> {
    return this.disputes.find({ where: { tripId }, order: { createdAt: 'DESC' } });
  }

  findAll(status?: DisputeStatus): Promise<Dispute[]> {
    return this.disputes.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
    });
  }

  async resolve(id: string, dto: ResolveDisputeDto): Promise<Dispute> {
    const dispute = await this.disputes.findOneBy({ id });
    if (!dispute) {
      throw new NotFoundException('Dispute not found');
    }
    dispute.status = DisputeStatus.RESOLVED;
    dispute.resolutionNote = dto.resolutionNote;
    dispute.resolvedAt = new Date();
    return this.disputes.save(dispute);
  }
}
