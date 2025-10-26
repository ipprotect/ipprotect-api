import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './utils/token.service';
import { Argon2Service } from './utils/argon2.service';
import { AppConfigService } from '../common/config/config.service';
import { use } from 'passport';

type CookieOpts = {
  httpOnly: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  secure: boolean;
  domain?: string;
  path?: string;
};

type AuthResponse = {
  user: { id: string; email: string; fullName?: string | null };
  access: string;
  refresh: string;
  accessTtl: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly argon: Argon2Service,
    private readonly cfg: AppConfigService,
  ) {}

  getRefreshCookieOptions(): CookieOpts {
    const samesite: 'lax' | 'strict' | 'none' = this.cfg.getAllowedOrigins().length
      ? 'none'
      : 'lax';
    return {
      httpOnly: true,
      sameSite: samesite,
      secure: true,
      domain: this.cfg.getCookieDomain() ?? undefined,
      path: this.cfg.getApiPrefix(),
    };
  }

  private refreshExpiryDate(): Date {
    return new Date(Date.now() + this.cfg.getJwtRefreshTtlMs());
  }

  async login(input: {
    email: string;
    password: string;
    deviceId?: string;
  }): Promise<AuthResponse> {
    const email = input.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const ok = await this.argon.verify(user.passwordHash, input.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    // Optional: revoke same-device active sessions to keep it tidy
    if (input.deviceId) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: user.id, deviceId: input.deviceId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    const pair = this.tokens.issuePair({ id: user.id, email: user.email });

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        hashedJti: await this.argon.hash(pair.jti),
        deviceId: input.deviceId ?? 'default',
        expiresAt: this.refreshExpiryDate(),
      },
    });

    return {
      user: { id: user.id, email: user.email, fullName: user.fullName },
      access: pair.access,
      refresh: pair.refresh,
      accessTtl: this.cfg.getJwtAccessTtl(),
    };
  }

  async signup(input: {
    email: string;
    password: string;
    fullName?: string;
    jurisdiction?: string;
    termsVersionAccepted: string;
    deviceId?: string;
    ip?: string;
    userAgent?: string;
  }): Promise<AuthResponse> {
    const email = input.email.trim().toLowerCase();

    const { user, pair } = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email } });
      if (existing) throw new ConflictException('Email already registered');

      const passwordHash = await this.argon.hash(input.password);

      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          fullName: input.fullName,
          jurisdiction: input.jurisdiction,
          termsVersionAccepted: input.termsVersionAccepted,
          termsAcceptances: {
            create: {
              version: input.termsVersionAccepted,
              jurisdiction: input.jurisdiction ?? 'US',
              ipAddress: input.ip,
              userAgent: input.userAgent,
            },
          },
        },
      });

      const pair = this.tokens.issuePair({ id: user.id, email: user.email });

      await tx.refreshToken.create({
        data: {
          userId: user.id,
          hashedJti: await this.argon.hash(pair.jti),
          deviceId: input.deviceId ?? 'default',
          expiresAt: this.refreshExpiryDate(),
        },
      });

      return { user, pair };
    });

    return {
      user: { id: user.id, email: user.email, fullName: user.fullName },
      access: pair.access,
      refresh: pair.refresh,
      accessTtl: this.cfg.getJwtAccessTtl(),
    };
  }

  /** Validate refresh jti, revoke it, and issue a new pair */
  async rotateRefresh(
    userId: string,
    jti: string,
  ): Promise<{ access: string; refresh: string; accessTtl: string }> {
    // find recent, unrevoked sessions
    const sessions = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 20, // sanity cap on the work we do
    });

    // locate the matching jti by argon verify
    let matchedId: string | null = null;
    for (const s of sessions) {
      if (await this.argon.verify(s.hashedJti, jti)) {
        matchedId = s.id;
        break;
      }
    }
    if (!matchedId) throw new UnauthorizedException('Invalid refresh');

    // revoke the matched token
    await this.prisma.refreshToken.update({
      where: { id: matchedId },
      data: { revokedAt: new Date() },
    });

    // cap active sessions to MAX_ACTIVE by revoking the oldest
    const MAX_ACTIVE = 10;
    const active = await this.prisma.refreshToken.findMany({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' }, // newest first
    });

    if (active.length > MAX_ACTIVE) {
      const toRevokeIds = active.slice(MAX_ACTIVE).map((t) => t.id); // keep newest MAX_ACTIVE
      if (toRevokeIds.length) {
        await this.prisma.refreshToken.updateMany({
          where: { id: { in: toRevokeIds } },
          data: { revokedAt: new Date() },
        });
      }
    }

    // issue new pair + persist new refresh (rotation)
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const pair = this.tokens.issuePair({ id: user.id, email: user.email });

    await this.prisma.refreshToken.create({
      data: {
        userId,
        hashedJti: await this.argon.hash(pair.jti),
        expiresAt: this.refreshExpiryDate(),
      },
    });

    return { access: pair.access, refresh: pair.refresh, accessTtl: this.cfg.getJwtAccessTtl() };
  }

  async logoutAll(userId: string): Promise<{ ok: true }> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }
}
