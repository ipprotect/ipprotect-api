import { Injectable, UnauthorizedException } from '@nestjs/common';
import jwt, { type JwtPayload, type SignOptions, type VerifyOptions } from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { AppConfigService } from '../../common/config/config.service';

/** Access-token payload (what your APIs will read) */
export interface AccessPayload extends JwtPayload {
  sub: string; // user id
  email: string; // user email
}

/** Refresh-token payload (used only for rotation) */
export interface RefreshPayload extends JwtPayload {
  sub: string; // user id
  jti: string; // session id
}

export type JwtPair = { access: string; refresh: string; jti: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function assertAccessPayload(p: unknown): asserts p is AccessPayload {
  if (!isRecord(p) || typeof p.sub !== 'string' || typeof p.email !== 'string') {
    throw new UnauthorizedException('Invalid access token payload');
  }
}

function assertRefreshPayload(p: unknown): asserts p is RefreshPayload {
  if (!isRecord(p) || typeof p.sub !== 'string' || typeof p.jti !== 'string') {
    throw new UnauthorizedException('Invalid refresh token payload');
  }
}

@Injectable()
export class TokenService {
  constructor(private readonly cfg: AppConfigService) {}

  newJti(): string {
    return randomUUID();
  }

  /** Parse "900s" | "15m" | "12h" | "30d" -> seconds (number). Fallback: try Number(). */
  private parseDurationToSeconds(input: string): number {
    const m = /^(\d+)(s|m|h|d)$/i.exec(input.trim());
    if (m) {
      const value = Number(m[1]);
      const unit = m[2].toLowerCase();
      const factor =
        unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 60 * 60 : /* 'd' */ 60 * 60 * 24;
      return value * factor;
    }
    const n = Number(input);
    return Number.isFinite(n) ? n : 900; // safe default: 15min
  }

  private accessSignOpts(): SignOptions {
    const opts: SignOptions = {
      algorithm: 'RS256',
      // use number to satisfy jsonwebtoken's typed "ms.StringValue | number"
      expiresIn: this.parseDurationToSeconds(this.cfg.getJwtAccessTtl()),
    };
    return opts;
  }

  private refreshSignOpts(): SignOptions {
    const opts: SignOptions = {
      algorithm: 'RS256',
      expiresIn: this.parseDurationToSeconds(this.cfg.getJwtRefreshTtl()),
    };
    return opts;
  }

  private accessVerifyOpts(): VerifyOptions {
    const opts: VerifyOptions = { algorithms: ['RS256'] };
    return opts;
  }

  private refreshVerifyOpts(): VerifyOptions {
    const opts: VerifyOptions = { algorithms: ['RS256'] };
    return opts;
  }

  signAccess(payload: Omit<AccessPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.cfg.getAccessPrivateKey(), this.accessSignOpts());
  }

  signRefresh(payload: Omit<RefreshPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, this.cfg.getRefreshPrivateKey(), this.refreshSignOpts());
  }

  issuePair(user: { id: string; email: string }): JwtPair {
    const jti = this.newJti();
    const access = this.signAccess({ sub: user.id, email: user.email });
    const refresh = this.signRefresh({ sub: user.id, jti });
    return { access, refresh, jti };
  }

  private verifyObject<T extends JwtPayload>(
    token: string,
    pubKey: string,
    opts: VerifyOptions,
  ): T {
    const decoded = jwt.verify(token, pubKey, opts);
    if (typeof decoded === 'string') throw new UnauthorizedException('Malformed token');
    return decoded as T;
  }

  verifyAccess(token: string): AccessPayload {
    const decoded = this.verifyObject<AccessPayload>(
      token,
      this.cfg.getAccessPublicKey(),
      this.accessVerifyOpts(),
    );
    assertAccessPayload(decoded);
    return decoded;
  }

  verifyRefresh(token: string): RefreshPayload {
    const decoded = this.verifyObject<RefreshPayload>(
      token,
      this.cfg.getRefreshPublicKey(),
      this.refreshVerifyOpts(),
    );
    assertRefreshPayload(decoded);
    return decoded;
  }
}
