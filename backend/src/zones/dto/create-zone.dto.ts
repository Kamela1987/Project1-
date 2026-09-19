import { ArrayMinSize, IsArray, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateZoneDto {
  @IsString()
  @MinLength(1)
  name: string;

  /** Optional multi-town grouping (Phase 4) — must be an existing Town's id if given. */
  @IsOptional()
  @IsUUID()
  townId?: string;

  /**
   * Optional polygon boundary for point-in-zone matching (see
   * ZonesService.findContainingPoint, used by the fare estimate). A single
   * ring of `[lng, lat]` pairs — GeoJSON coordinate order, not `[lat, lng]`
   * — with at least 4 points and the first/last point equal (a closed
   * ring). No holes; that's more than a small-town pricing zone needs.
   * Leave unset to create the zone as a plain pricing bucket with no
   * geographic matching yet, same as before this field existed.
   */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(4)
  boundary?: [number, number][];
}
