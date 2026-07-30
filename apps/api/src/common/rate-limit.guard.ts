import type { CanActivate, ExecutionContext, Type } from '@nestjs/common';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

interface Bucket {
  count: number;
  windowStartMs: number;
}

export interface RateLimitGuardOptions {
  windowMs: number;
  maxRequests: number;
  keyFromRequest?: (request: FastifyRequest) => string;
  message?: string;
}

/**
 * Factory for fixed-window in-memory rate limit guards (E6.2).
 * Not distributed — sufficient for single-instance local/dev; use a shared store in multi-instance prod.
 */
export function createRateLimitGuard(options: RateLimitGuardOptions): Type<CanActivate> {
  const {
    windowMs,
    maxRequests,
    keyFromRequest = (req) => req.ip ?? 'unknown',
    message = 'Too many requests, please try again later',
  } = options;

  @Injectable()
  class DynamicRateLimitGuard implements CanActivate {
    private readonly buckets = new Map<string, Bucket>();

    canActivate(context: ExecutionContext): boolean {
      const request = context.switchToHttp().getRequest<FastifyRequest>();
      const key = keyFromRequest(request);
      const now = Date.now();
      const bucket = this.buckets.get(key);

      if (!bucket || now - bucket.windowStartMs > windowMs) {
        this.buckets.set(key, { count: 1, windowStartMs: now });
        return true;
      }

      if (bucket.count >= maxRequests) {
        throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
      }

      bucket.count += 1;
      return true;
    }
  }

  return DynamicRateLimitGuard;
}

/** Auth endpoints — strict (10 req/min per IP). */
export const AuthRateLimitGuard = createRateLimitGuard({
  windowMs: 60_000,
  maxRequests: 10,
});

/** Parent cabinet routes — 120 req/min per parent subject or IP. */
export const ParentApiRateLimitGuard = createRateLimitGuard({
  windowMs: 60_000,
  maxRequests: 120,
  keyFromRequest: (req) => {
    const auth = req.headers.authorization;
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      return `parent:${auth.slice(7, 47)}`;
    }
    return `ip:${req.ip ?? 'unknown'}`;
  },
  message: 'Parent API rate limit exceeded',
});

/** Internal agent routes — 600 req/min per service token prefix or IP. */
export const InternalApiRateLimitGuard = createRateLimitGuard({
  windowMs: 60_000,
  maxRequests: 600,
  keyFromRequest: (req) => {
    const auth = req.headers.authorization;
    if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
      return `svc:${auth.slice(7, 23)}`;
    }
    return `ip:${req.ip ?? 'unknown'}`;
  },
  message: 'Internal API rate limit exceeded',
});
