import { IsBoolean } from 'class-validator';

export class SetOnlineDto {
  @IsBoolean()
  isOnline: boolean;
}
