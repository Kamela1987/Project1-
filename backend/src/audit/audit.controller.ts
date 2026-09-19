import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../entities/user.entity';
import { PaginationQueryDto, resolvePagination } from '../common/pagination.dto';
import { AuditService } from './audit.service';

/** Who approved a driver, who resolved a dispute — see AuditService's own comment for why this exists. */
@Controller('audit-log')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles(UserRole.ADMIN)
  listAll(@Query() pagination: PaginationQueryDto) {
    const { page, pageSize } = resolvePagination(pagination);
    return this.auditService.listAll(page, pageSize);
  }
}
