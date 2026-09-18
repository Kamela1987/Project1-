import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { CreateFareRuleDto } from './dto/create-fare-rule.dto';
import { FareRulesService } from './fare-rules.service';

@Controller('zones/:zoneId/fare-rules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FareRulesController {
  constructor(private readonly fareRulesService: FareRulesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Param('zoneId') zoneId: string, @Body() dto: CreateFareRuleDto) {
    return this.fareRulesService.create(zoneId, dto);
  }

  @Get()
  findByZone(@Param('zoneId') zoneId: string) {
    return this.fareRulesService.findByZone(zoneId);
  }
}

/** Standalone delete-by-id route, since a fare rule id is already globally unique. */
@Controller('fare-rules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FareRuleController {
  constructor(private readonly fareRulesService: FareRulesService) {}

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  delete(@Param('id') id: string) {
    return this.fareRulesService.delete(id);
  }
}
