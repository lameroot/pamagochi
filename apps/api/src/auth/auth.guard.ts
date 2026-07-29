import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import type { ParentAccount } from '@pamagochi/database';
import {
  IDENTITY_PROVIDER,
  InvalidAccessTokenError,
  type IdentityProvider,
} from './domain/identity-provider.js';
import { ParentAccountService } from './parent-account.service.js';

export interface AuthenticatedFastifyRequest extends FastifyRequest {
  parentAccount: ParentAccount;
}

function extractBearerToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;
  if (!header) return undefined;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return undefined;
  return token;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(IDENTITY_PROVIDER) private readonly identityProvider: IdentityProvider,
    private readonly parentAccountService: ParentAccountService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedFastifyRequest>();
    const token = extractBearerToken(request);
    if (!token) throw new UnauthorizedException('Missing bearer token');

    try {
      const identity = await this.identityProvider.verifyAccessToken(token);
      request.parentAccount = await this.parentAccountService.upsertFromIdentity(identity);
      return true;
    } catch (error) {
      if (error instanceof InvalidAccessTokenError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }
  }
}
