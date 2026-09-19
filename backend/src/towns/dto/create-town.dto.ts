import { ArrayMinSize, IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTownDto {
  @IsString()
  @MinLength(1)
  name: string;

  /** Same shape/rules as CreateZoneDto's `boundary` — a closed ring of `[lng, lat]` pairs. Optional; a town with no boundary yet still exists as an admin grouping, just isn't matched by point. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(4)
  boundary?: [number, number][];
}
