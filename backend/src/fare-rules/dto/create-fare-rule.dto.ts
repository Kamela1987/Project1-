import { IsEnum, IsNumber, Min } from 'class-validator';
import { VehicleType } from '../../entities/vehicle.entity';

export class CreateFareRuleDto {
  @IsEnum(VehicleType)
  vehicleType: VehicleType;

  @IsNumber()
  @Min(0)
  baseFare: number;

  @IsNumber()
  @Min(0)
  perKmRate: number;

  @IsNumber()
  @Min(0)
  perMinRate: number;
}
