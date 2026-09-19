import { IsIn, IsNumber, IsOptional, IsPhoneNumber, Min } from 'class-validator';
import { PaymentMethod } from '../../entities/payment-method.enum';

export class RequestPayoutDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsIn([PaymentMethod.MOMO, PaymentMethod.AIRTEL])
  method: PaymentMethod;

  /** Defaults to the driver's account phone number if omitted. */
  @IsOptional()
  @IsPhoneNumber()
  phoneNumber?: string;
}
