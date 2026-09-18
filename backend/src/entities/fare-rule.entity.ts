import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Zone } from './zone.entity';
import { VehicleType } from './vehicle.entity';

/** One rate card per zone + vehicle type (see architecture doc §6.3's fare formula). */
@Entity('fare_rules')
@Index(['zoneId', 'vehicleType'], { unique: true })
export class FareRule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Zone, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'zone_id' })
  zone: Zone;

  @Column({ name: 'zone_id' })
  zoneId: string;

  @Column({ type: 'enum', enum: VehicleType })
  vehicleType: VehicleType;

  @Column('decimal', { precision: 10, scale: 2 })
  baseFare: string;

  @Column('decimal', { precision: 10, scale: 2 })
  perKmRate: string;

  @Column('decimal', { precision: 10, scale: 2 })
  perMinRate: string;
}
