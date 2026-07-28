import { Injectable } from '@nestjs/common';
import type { AuthenticatedIdentity } from '@pamagochi/contracts';
import { AppConfigService } from '../../config/app-config.service.js';
import { InvalidAccessTokenError, type IdentityProvider } from '../domain/identity-provider.js';
import { verifyLocalJwt } from './local-jwt.js';

@Injectable()
export class LocalIdentityProvider implements IdentityProvider {
  constructor(private readonly config: AppConfigService) {}

  async verifyAccessToken(token: string): Promise<AuthenticatedIdentity> {
    try {
      const payload = verifyLocalJwt(token, this.config.devAuthSecret);
      return {
        subject: payload.sub,
        email: payload.email,
        roles: payload.roles ?? [],
        provider: 'local',
      };
    } catch {
      throw new InvalidAccessTokenError();
    }
  }
}
