import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { DevLoginModule } from './auth/local/dev-login.module.js';
import { ConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { GameSessionsModule } from './game-sessions/game-sessions.module.js';
import { HealthModule } from './health/health.module.js';
import { IntroProgressModule } from './intro-progress/intro-progress.module.js';
import { InternalModule } from './internal/internal.module.js';
import { JobsModule } from './jobs/jobs.module.js';
import { ParentCabinetModule } from './parent-cabinet/parent-cabinet.module.js';
import { ProfilesModule } from './profiles/profiles.module.js';
import { StorageModule } from './storage/storage.module.js';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    JobsModule,
    AuthModule,
    DevLoginModule.forRoot(),
    HealthModule,
    ProfilesModule,
    ParentCabinetModule,
    GameSessionsModule,
    IntroProgressModule,
    InternalModule,
    StorageModule.forRoot(),
  ],
})
export class AppModule {}
