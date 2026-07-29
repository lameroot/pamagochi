import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { ParentAccount } from '@pamagochi/database';
import type { AuthenticatedFastifyRequest } from './auth.guard.js';

export const CurrentParent = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ParentAccount => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedFastifyRequest>();
    return request.parentAccount;
  },
);
