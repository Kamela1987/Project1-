import { IsString, MinLength } from 'class-validator';

export class ResolveDisputeDto {
  @IsString()
  @MinLength(1)
  resolutionNote: string;
}
