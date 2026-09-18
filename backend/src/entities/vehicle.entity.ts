import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Driver } from './driver.entity';

export enum VehicleType {
  SEDAN = 'sedan',
  MINIBUS = 'minibus',
  /** Motorbike taxis (boda-bodas) are widespread and growing fast in
   * Monze — cheaper, quicker through congestion, and better suited to
   * unpaved/narrow roads than a car. Treated as a first-class vehicle
   * type rather than an afterthought. */
  MOTORBIKE = 'motorbike',
}

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => Driver, (driver) => driver.vehicle)
  @JoinColumn({ name: 'driver_id' })
  driver: Driver;

  @Column({ name: 'driver_id' })
  driverId: string;

  @Column({ type: 'enum', enum: VehicleType })
  type: VehicleType;

  @Column({ unique: true })
  plateNumber: string;

  @Column({ nullable: true })
  photoUrl?: string;
}
