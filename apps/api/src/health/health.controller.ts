import { Controller, Get } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import type { LivenessResponse, ReadinessCheck, ReadinessResponse } from '@pamagochi/contracts';
import { AppConfigService } from '../config/app-config.service.js';
import { PrismaService } from '../database/prisma.service.js';

@Controller('api/health')
export class HealthController {
  constructor(
    private readonly config: AppConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('live')
  @ApiExcludeEndpoint()
  live(): LivenessResponse {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready(): Promise<ReadinessResponse> {
    const checks: ReadinessCheck[] = [];

    const dbHealthy = await this.prisma.isHealthy();
    checks.push({
      name: 'postgres',
      status: dbHealthy ? 'ok' : 'fail',
      message: dbHealthy ? undefined : 'Could not reach the database',
    });

    checks.push({ name: 'config', status: 'ok' });

    checks.push({
      name: 'providers',
      status: 'ok',
      message: `auth=${this.config.authProvider} storage=${this.config.storageProvider} jobs=${this.config.jobProvider}`,
    });

    const status = checks.every((c) => c.status === 'ok') ? 'ok' : 'fail';
    return { status, checks };
  }
}
