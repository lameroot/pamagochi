import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { ChildrenController } from './children.controller.js';
import { DemoController } from './demo.controller.js';
import { MeController } from './me.controller.js';

@Module({
  imports: [AuthModule, DatabaseModule],
  controllers: [MeController, ChildrenController, DemoController],
})
export class ProfilesModule {}
