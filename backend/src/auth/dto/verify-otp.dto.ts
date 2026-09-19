import { IsEnum, IsOptional, IsPhoneNumber, IsString, Length } from 'class-validator';
import { UserRole } from '../../entities/user.entity';

export class VerifyOtpDto {
  @IsPhoneNumber()
  phoneNumber: string;

  @IsString()
  @Length(4, 6)
  otp: string;

  /** Only used the first time a phone number registers. */
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  /** Only used the first time a phone number registers — see AuthService.verifyOtp and ReferralsService.resolveReferrer. */
  @IsOptional()
  @IsString()
  referralCode?: string;
}
