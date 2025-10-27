import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, type JwtFromRequestFunction } from 'passport-jwt';
import type { JwtPayload } from 'jsonwebtoken';
import { AppConfigService } from '../../common/config/config.service';
import type { Request } from 'express';

export interface RefreshPayload extends JwtPayload {
  sub: string; // user id
  jti: string; // session id
}

type UnknownCookiesReq = { cookies?: unknown };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}
function assertRefreshPayload(p: unknown): asserts p is RefreshPayload {
  if (!isRecord(p) || typeof p.sub !== 'string' || typeof p.jti !== 'string') {
    throw new UnauthorizedException('Invalid refresh token payload');
  }
}

// Prefer a typed extractor (cookie -> string|null)

export const cookieExtractor: JwtFromRequestFunction = (req) => {
  if (!req) return null;

  const maybeCookies = (req as UnknownCookiesReq).cookies;

  if (typeof maybeCookies === 'object' && maybeCookies !== null) {
    const cookies = maybeCookies as Record<string, unknown>;
    const value = cookies['refresh'];
    return typeof value === 'string' ? value : null;
  }
  return null;
};

@Injectable()
export class JwtRefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(cfg: AppConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([cookieExtractor]),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      secretOrKey: cfg.getRefreshPublicKey(),
    });
  }

  // Synchronous validate; Passport will attach this to req.user
  validate(payload: unknown): RefreshPayload {
    assertRefreshPayload(payload);
    return payload;
  }
}
