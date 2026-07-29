import type { AuthenticatedIdentity } from '@pamagochi/contracts';

export interface IdentityProvider {
  verifyAccessToken(token: string): Promise<AuthenticatedIdentity>;
}

export const IDENTITY_PROVIDER = Symbol('IDENTITY_PROVIDER');

export class InvalidAccessTokenError extends Error {
  constructor(message = 'Invalid or expired access token') {
    super(message);
    this.name = 'InvalidAccessTokenError';
  }
}
