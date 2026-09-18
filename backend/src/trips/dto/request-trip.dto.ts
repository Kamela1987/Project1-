import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { VehicleType } from '../../entities/vehicle.entity';
import { PaymentMethod } from '../../entities/payment-method.enum';

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

  /** Defaults to cash. "momo" or "airtel" triggers a mobile money request at trip completion. */
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
