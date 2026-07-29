import { timingSafeEqual } from 'node:crypto';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { AppConfigService } from '../config/app-config.service.js';

function tokensEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

@Injectable()
export class ServiceAuthGuard implements CanActivate {
  constructor(private readonly config: AppConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.voiceAgentServiceToken;
    if (!expected) {
      throw new UnauthorizedException('Service auth is not configured');
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const header = request.headers.authorization;
    const token =
      typeof header === 'string' && header.toLowerCase().startsWith('bearer ')
        ? header.slice(7).trim()
        : undefined;

    if (!token || !tokensEqual(token, expected)) {
      throw new UnauthorizedException('Invalid service token');
    }
    return true;
  }
}
