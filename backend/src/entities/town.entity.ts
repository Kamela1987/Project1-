import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Multi-town support (Phase 4): the top-level geographic grouping used to
 * scope driver-trip matching so a driver in one town never sees trip
 * requests from another (see TripsService.listAvailable). Coarser-grained
 * than Zone, which is a pricing sub-area *within* a town (e.g. town-center
 * vs. outlying) — a Town can contain many Zones (Zone.townId, optional).
 *
 * Same `boundary`/`select: false` shape as Zone — see that entity's
 * comment for why. A town with no boundary drawn yet is still a valid
 * pricing/admin grouping, just not usable for point-in-town matching.
 */
@Entity('towns')
export class Town {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column('geometry', { spatialFeatureType: 'Polygon', srid: 4326, nullable: true, select: false })
  boundary?: string | null;
}
