import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class SettleWalletDto {
  /** Amount the driver has paid toward their commission debt. */
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  note?: string;
}
