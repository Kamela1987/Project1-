import { IsNumber, Min } from 'class-validator';

export class CompleteTripDto {
  /** Fare agreed with the rider, collected as cash in Phase 1. */
  @IsNumber()
  @Min(0)
  fareAmount: number;
}
