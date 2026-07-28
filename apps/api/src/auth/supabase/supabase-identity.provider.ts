import { Injectable } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { AuthenticatedIdentity } from '@pamagochi/contracts';
import { AppConfigService } from '../../config/app-config.service.js';
import { InvalidAccessTokenError, type IdentityProvider } from '../domain/identity-provider.js';

interface SupabaseJwtPayload extends JWTPayload {
  email?: string;
  role?: string;
  app_metadata?: { roles?: string[] };
}

/**
 * Verifies Supabase-issued user JWTs using the project's JWKS endpoint.
 * `createRemoteJWKSet` caches keys internally and transparently re-fetches
 * on unknown `kid` (key rotation), so we never need to manage caching
 * ourselves. Never uses SUPABASE_SERVICE_ROLE_KEY for user JWT verification.
 */
@Injectable()
export class SupabaseIdentityProvider implements IdentityProvider {
  private jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

  constructor(private readonly config: AppConfigService) {}

  private getJwks(): ReturnType<typeof createRemoteJWKSet> {
    if (!this.jwks) {
      const jwksUrl = this.config.supabase.jwksUrl;
      if (!jwksUrl) throw new Error('SUPABASE_JWKS_URL is not configured');
      this.jwks = createRemoteJWKSet(new URL(jwksUrl));
    }
    return this.jwks;
  }

  async verifyAccessToken(token: string): Promise<AuthenticatedIdentity> {
    try {
      const { jwtIssuer, jwtAudience } = this.config.supabase;
      const { payload } = await jwtVerify<SupabaseJwtPayload>(token, this.getJwks(), {
        issuer: jwtIssuer,
        audience: jwtAudience,
      });

      if (!payload.sub) throw new InvalidAccessTokenError('Token is missing subject claim');

      const roles = payload.app_metadata?.roles ?? (payload.role ? [payload.role] : []);

      return {
        subject: payload.sub,
        email: payload.email,
        roles,
        provider: 'supabase',
      };
    } catch (error) {
      if (error instanceof InvalidAccessTokenError) throw error;
      throw new InvalidAccessTokenError();
    }
  }
}
