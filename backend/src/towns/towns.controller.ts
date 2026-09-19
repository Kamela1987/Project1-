import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { CreateTownDto } from './dto/create-town.dto';
import { TownsService } from './towns.service';

@Controller('towns')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TownsController {
  constructor(private readonly townsService: TownsService) {}

  @Post()
  @Roles(UserRole.ADMIN)
  create(@Body() dto: CreateTownDto) {
    return this.townsService.create(dto);
  }

  /** Public read — riders/drivers don't need admin rights to see what towns exist. */
  @Get()
  findAll() {
    return this.townsService.findAll();
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  delete(@Param('id') id: string) {
    return this.townsService.delete(id);
  }
}
