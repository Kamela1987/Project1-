import { IsEnum, IsNumber, IsOptional } from 'class-validator';
import { VehicleType } from '../../entities/vehicle.entity';

export class FareEstimateDto {
  @IsNumber()
  pickupLat: number;

  @IsNumber()
  pickupLng: number;

  @IsNumber()
  dropoffLat: number;

  @IsNumber()
  dropoffLng: number;

  /** Leave unset to get an estimate for every vehicle type priced in the pickup's zone. */
  @IsOptional()
  @IsEnum(VehicleType)
  vehicleType?: VehicleType;
}
