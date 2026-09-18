import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Phase 1-2 note: no `boundary` geography column yet — trips don't carry a
 * zoneId (fare is still manually entered by the driver at completion, see
 * TripsService.complete), so a zone is just a named pricing bucket an
 * admin can configure ahead of time. Wiring "which zone is this pickup
 * in" and an automated fare estimate is future work (see architecture
 * doc §6.3, §9 Phase 4).
 */
@Entity('zones')
export class Zone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;
}
