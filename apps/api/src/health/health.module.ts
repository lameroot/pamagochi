import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { HealthController } from './health.controller.js';
import { MetaController } from './meta.controller.js';

@Module({
  imports: [ConfigModule, DatabaseModule],
  controllers: [HealthController, MetaController],
})
export class HealthModule {}
