import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum AuditAction {
  DRIVER_APPROVED = 'driver.approved',
  DISPUTE_RESOLVED = 'dispute.resolved',
}

/**
 * An immutable record of who did an admin-only action — which admin
 * approved a driver, which admin resolved a dispute. Append-only, same
 * shape as `LedgerEntry`/`TripStatusEvent`: never updated after insert,
 * so "who did this and when" is always reconstructable, not just the
 * current state.
 */
@Entity('audit_log_entries')
export class AuditLogEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'actor_user_id' })
  actorUserId: string;

  @Column({ type: 'enum', enum: AuditAction })
  action: AuditAction;

  /** The row the action was taken on — a driverId for DRIVER_APPROVED, a disputeId for DISPUTE_RESOLVED. */
  @Column({ name: 'target_id' })
  targetId: string;

  /** Free-form context for this entry — e.g. the dispute's resolution note. Never the whole target row, just enough to explain the action without a join. */
  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}
