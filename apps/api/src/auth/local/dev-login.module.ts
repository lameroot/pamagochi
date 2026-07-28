import { type DynamicModule, Module } from '@nestjs/common';
import { ConfigModule } from '../../config/config.module.js';
import { DevLoginController } from './dev-login.controller.js';

/**
 * `/api/dev/login` must not merely 404 by config check but must not even be
 * registered as a route when running the cloud profile — this decides
 * controller registration at module-build time (before Nest DI spins up),
 * based on raw process.env, so it never shows up in the cloud Swagger doc
 * or route table at all. `AppConfigService.devAuthEnabled` is still
 * checked inside the controller as defense-in-depth.
 */
function isLocalDevAuthCandidate(): boolean {
  return process.env.APP_PROFILE === 'local' && process.env.AUTH_PROVIDER === 'local';
}

@Module({})
export class DevLoginModule {
  static forRoot(): DynamicModule {
    const registerDevLogin = isLocalDevAuthCandidate();
    return {
      module: DevLoginModule,
      imports: [ConfigModule],
      controllers: registerDevLogin ? [DevLoginController] : [],
    };
  }
}
