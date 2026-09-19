import { IsEnum, IsOptional, IsString } from 'class-validator';
import { VehicleType } from '../../entities/vehicle.entity';

export class RegisterVehicleDto {
  @IsEnum(VehicleType)
  type: VehicleType;

  @IsString()
  plateNumber: string;

  @IsOptional()
  @IsString()
  photoUrl?: string;
}
