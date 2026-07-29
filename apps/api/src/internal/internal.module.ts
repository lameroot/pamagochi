import { Module } from '@nestjs/common';
import { InternalAgentController } from './internal-agent.controller.js';
import { ServiceAuthGuard } from './service-auth.guard.js';

@Module({
  controllers: [InternalAgentController],
  providers: [ServiceAuthGuard],
})
export class InternalModule {}
