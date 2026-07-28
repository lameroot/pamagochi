import { Controller, Get } from '@nestjs/common';
import type { VersionResponse } from '@pamagochi/contracts';
import { AppConfigService } from '../config/app-config.service.js';

const API_VERSION = '0.1.0';

@Controller('api/meta')
export class MetaController {
  constructor(private readonly config: AppConfigService) {}

  @Get('version')
  version(): VersionResponse {
    return {
      appName: 'pamagochi-api',
      apiVersion: API_VERSION,
      commitSha: this.config.commitSha,
      buildTime: this.config.buildTime,
      appProfile: this.config.appProfile,
      authProvider: this.config.authProvider,
    };
  }
}
