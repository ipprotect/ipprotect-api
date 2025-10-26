import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';

export interface JwtUser {
  sub: string;
  email?: string;
  roles?: string[];
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser | undefined => {
    const req = ctx.switchToHttp().getRequest<{ user?: JwtUser }>();
    return req.user;
  },
);
