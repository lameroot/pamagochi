import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

interface Bucket {
  count: number;
  windowStartMs: number;
}

/**
 * Minimal in-memory fixed-window rate limiter for sensitive auth endpoints
 * (`/api/dev/login` and friends). Not distributed — sufficient for a
 * single-instance local/dev deployment; a shared store would be required
 * for a multi-instance production deployment.
 */
@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private static readonly WINDOW_MS = 60_000;
  private static readonly MAX_REQUESTS = 10;
  private readonly buckets = new Map<string, Bucket>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const key = request.ip ?? 'unknown';
    const now = Date.now();
    const bucket = this.buckets.get(key);

    if (!bucket || now - bucket.windowStartMs > AuthRateLimitGuard.WINDOW_MS) {
      this.buckets.set(key, { count: 1, windowStartMs: now });
      return true;
    }

    if (bucket.count >= AuthRateLimitGuard.MAX_REQUESTS) {
      throw new HttpException(
        'Too many requests, please try again later',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    bucket.count += 1;
    return true;
  }
}
