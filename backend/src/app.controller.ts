import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/**
 * Liveness/readiness probe for container orchestrators and the CI smoke
 * test (see .github/workflows/backend-ci.yml). `ok: false` (still HTTP 200
 * — a 5xx here would make an orchestrator kill-loop a container that's up
 * but briefly lost its DB connection) signals "don't route traffic yet"
 * without tearing the process down.
 */
@Controller()
export class AppController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get('health')
  health() {
    return { ok: this.dataSource.isInitialized, uptime: process.uptime() };
  }
}
