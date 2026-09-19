import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditAction, AuditLogEntry } from '../entities/audit-log-entry.entity';
import { Page } from '../common/pagination.dto';
import { UsersService } from '../users/users.service';

export interface AuditLogEntryWithActor extends AuditLogEntry {
  actorName: string | null;
  actorPhoneNumber: string | null;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLogEntry) private readonly entries: Repository<AuditLogEntry>,
    private readonly usersService: UsersService,
  ) {}

  record(actorUserId: string, action: AuditAction, targetId: string, metadata?: Record<string, unknown>): Promise<AuditLogEntry> {
    return this.entries.save(this.entries.create({ actorUserId, action, targetId, metadata }));
  }

  /** Admin's audit feed, newest first — who did what, to which driver/dispute, and when. */
  async listAll(page: number, pageSize: number): Promise<Page<AuditLogEntryWithActor>> {
    const [entries, total] = await this.entries.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // A batch lookup, not an N+1 per row — a page's entries usually share
    // a handful of admin actors.
    const actorIds = [...new Set(entries.map((e) => e.actorUserId))];
    const actors = await this.usersService.findByIds(actorIds);
    const actorsById = new Map(actors.map((a) => [a.id, a]));

    const items = entries.map((entry) => ({
      ...entry,
      actorName: actorsById.get(entry.actorUserId)?.name ?? null,
      actorPhoneNumber: actorsById.get(entry.actorUserId)?.phoneNumber ?? null,
    }));

    return { items, total, page, pageSize };
  }
}
