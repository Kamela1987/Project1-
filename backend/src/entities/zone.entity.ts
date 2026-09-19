import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * `boundary` (PostGIS `geometry(Polygon, 4326)`, nullable — a zone can
 * exist as a pricing bucket before anyone's drawn its boundary) is
 * `select: false`: TypeORM has no built-in (de)serialization for PostGIS
 * geometry, so the normal repository API (`find`, `findOneBy`, ...) never
 * touches this column. All reads/writes of it go through explicit raw SQL
 * in ZonesService (`ST_GeomFromGeoJSON`/`ST_Contains`/`ST_AsGeoJSON`) —
 * see `findContainingPoint`, used by TripsService's fare estimate.
 */
@Entity('zones')
export class Zone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column('geometry', { spatialFeatureType: 'Polygon', srid: 4326, nullable: true, select: false })
  boundary?: string | null;
}
