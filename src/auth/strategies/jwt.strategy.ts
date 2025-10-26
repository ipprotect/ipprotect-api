import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtPayload } from 'jsonwebtoken';
import { AppConfigService } from '../../common/config/config.service';

/** What we expect inside the access token */
export interface AccessPayload extends JwtPayload {
  sub: string; // user id
  email: string; // user email
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function assertAccessPayload(p: unknown): asserts p is AccessPayload {
  if (!isRecord(p) || typeof p.sub !== 'string' || typeof p.email !== 'string') {
    throw new UnauthorizedException('Invalid access token payload');
  }
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(cfg: AppConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      secretOrKey: cfg.getAccessPublicKey(),
    });
  }

  /** Return value becomes req.user */
  validate(payload: unknown): AccessPayload {
    assertAccessPayload(payload);
    return payload;
  }
}
