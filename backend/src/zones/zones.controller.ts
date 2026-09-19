import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { CreateZoneDto } from './dto/create-zone.dto';
import { ZonesService } from './zones.service';

@Controller('zones')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateZoneDto) {
    return this.zonesService.create(dto);
  }

  /** Public read — riders/drivers don't need admin rights to see what zones exist. `?townId=` narrows to one town's zones. */
  @Get()
  findAll(@Query('townId') townId?: string) {
    return this.zonesService.findAll(townId);
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  delete(@Param('id') id: string) {
    return this.zonesService.delete(id);
  }
}
