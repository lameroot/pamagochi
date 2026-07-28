import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service.js';
import { ConfigModule } from '../config/config.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { AuthGuard } from './auth.guard.js';
import { CurrentParent } from './current-parent.decorator.js';
import { IDENTITY_PROVIDER } from './domain/identity-provider.js';
import { LocalIdentityProvider } from './local/local-identity.provider.js';
import { ParentAccountService } from './parent-account.service.js';
import { SupabaseIdentityProvider } from './supabase/supabase-identity.provider.js';

export { CurrentParent };

/**
 * Always-available (Global) module providing identity verification,
 * ParentAccount upsert and the AuthGuard, so any feature module can use
 * `@UseGuards(AuthGuard)` without re-importing a dynamic module (avoiding
 * the classic NestJS pitfall of `forRoot()` producing multiple instances).
 * The concrete identity provider actually used is selected at runtime via
 * `AppConfigService.authProvider` — the unused provider's constructor is
 * cheap and side-effect-free, so it is safe to keep both registered.
 */
@Global()
@Module({
  imports: [ConfigModule, DatabaseModule],
  providers: [
    LocalIdentityProvider,
    SupabaseIdentityProvider,
    ParentAccountService,
    AuthGuard,
    {
      provide: IDENTITY_PROVIDER,
      inject: [AppConfigService, LocalIdentityProvider, SupabaseIdentityProvider],
      useFactory: (
        config: AppConfigService,
        local: LocalIdentityProvider,
        supabase: SupabaseIdentityProvider,
      ) => (config.authProvider === 'local' ? local : supabase),
    },
  ],
  exports: [AuthGuard, ParentAccountService, IDENTITY_PROVIDER],
})
export class AuthModule {}
