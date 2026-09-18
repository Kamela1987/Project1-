import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { VehicleType } from '../../entities/vehicle.entity';

export class RequestTripDto {
  @IsNumber()
  pickupLat: number;

  @IsNumber()
  pickupLng: number;

  @IsOptional()
  @IsString()
  pickupLandmark?: string;

  @IsNumber()
  dropoffLat: number;

  @IsNumber()
  dropoffLng: number;

  @IsOptional()
  @IsString()
  dropoffLandmark?: string;

  /** Leave unset for "any vehicle" — otherwise "sedan" | "minibus" | "motorbike". */
  @IsOptional()
  @IsEnum(VehicleType)
  requestedVehicleType?: VehicleType;
}
