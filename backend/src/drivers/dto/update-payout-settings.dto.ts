import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { PaymentMethod } from '../../entities/payment-method.enum';

export class UpdatePayoutSettingsDto {
  @IsBoolean()
  autoPayoutEnabled: boolean;

  /** Required the first time autoPayoutEnabled is set to true (either in this same request or a stored one from before). */
  @IsOptional()
  @IsIn([PaymentMethod.MOMO, PaymentMethod.AIRTEL])
  payoutMethod?: PaymentMethod;
}
