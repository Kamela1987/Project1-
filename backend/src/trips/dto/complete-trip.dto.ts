import { IsEnum, IsNumber, IsOptional, Min } from 'class-validator';
import { PaymentMethod } from '../../entities/payment-method.enum';

export class CompleteTripDto {
  /** Fare agreed with the rider. */
  @IsNumber()
  @Min(0)
  fareAmount: number;

  /** Override the rider's requested payment method (e.g. they switch to cash at the door). Defaults to whatever the trip was requested with. */
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
