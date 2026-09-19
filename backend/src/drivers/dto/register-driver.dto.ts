import { IsString } from 'class-validator';

export class RegisterDriverDto {
  @IsString()
  licenseNumber: string;
}
