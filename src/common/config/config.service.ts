import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService as NestConfig } from '@nestjs/config';

function parseCsv(input: string | undefined): string[] {
  if (!input) return [];
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseAllowedOrigins(csv: string | undefined): string[] {
  const arr = parseCsv(csv);
  const out: string[] = [];
  for (const item of arr) {
    try {
      // Accept "*" as wildcard for local dev
      if (item === '*') {
        out.push('*');
        continue;
      }
      const u = new URL(item);
      out.push(u.origin);
    } catch {
      // skip invalid URL
    }
  }
  return out;
}

@Injectable()
export class AppConfigService implements OnModuleInit {
  private readonly logger = new Logger(AppConfigService.name);

  constructor(private readonly cfg: NestConfig) {}

  onModuleInit() {
    // One-time warnings for optional providers
    if (!this.getOpenAiKey())
      this.logger.log('AI disabled: OPENAI_API_KEY not set');
    if (!this.getIpfsToken())
      this.logger.log('IPFS disabled: WEB3_STORAGE_TOKEN not set');
    if (!this.getHederaPrivateKey() || !this.getHederaAccountId())
      this.logger.log(
        'Hedera disabled: HEDERA_ACCOUNT_ID / HEDERA_PRIVATE_KEY not set',
      );
  }

  // ── Server
  getNodeEnv(): 'development' | 'test' | 'production' {
    return (this.cfg.get<string>('NODE_ENV') as any) ?? 'development';
  }
  getPort(): number {
    const v = this.cfg.get<string>('PORT') ?? '4000';
    return Number.isNaN(Number(v)) ? 4000 : Number(v);
  }
  getApiPrefix(): string {
    const p = this.cfg.get<string>('API_PREFIX') ?? '/api';
    return p.startsWith('/') ? p : `/${p}`;
  }
  getAllowedOrigins(): string[] {
    return parseAllowedOrigins(this.cfg.get<string>('ALLOWED_ORIGINS') ?? '');
  }

  // ── JWT
  getJwtAccessSecret(): string {
    return this.cfg.getOrThrow<string>('JWT_ACCESS_SECRET');
    // `getOrThrow` will throw if missing, but Zod should catch earlier.
  }
  getJwtRefreshSecret(): string {
    return this.cfg.getOrThrow<string>('JWT_REFRESH_SECRET');
  }
  getJwtAccessTtl(): string {
    return this.cfg.get<string>('JWT_ACCESS_TTL', '900s');
  }
  getJwtRefreshTtl(): string {
    return this.cfg.get<string>('JWT_REFRESH_TTL', '30d');
  }

  // ── Database & Redis
  getDatabaseUrl(): string {
    return this.cfg.getOrThrow<string>('DATABASE_URL');
  }
  getRedisUrl(): string {
    return this.cfg.getOrThrow<string>('REDIS_URL');
  }

  // ── Optional providers
  getHederaAccountId(): string | null {
    const v = this.cfg.get<string>('HEDERA_ACCOUNT_ID')?.trim();
    return v ? v : null;
  }
  getHederaPrivateKey(): string | null {
    const v = this.cfg.get<string>('HEDERA_PRIVATE_KEY')?.trim();
    return v ? v : null;
  }
  getHederaTopicId(): string | null {
    const v = this.cfg.get<string>('HEDERA_TOPIC_ID')?.trim();
    return v ? v : null;
  }

  getIpfsToken(): string | null {
    const v = this.cfg.get<string>('WEB3_STORAGE_TOKEN')?.trim();
    return v ? v : null;
  }

  getOpenAiKey(): string | null {
    const v = this.cfg.get<string>('OPENAI_API_KEY')?.trim();
    return v ? v : null;
  }
  getOpenAiModel(): string {
    return this.cfg.get<string>('OPENAI_MODEL') ?? 'gpt-4o-mini';
  }

  getPublicVerifyUrl(): string | null {
    const v = this.cfg.get<string>('PUBLIC_VERIFY_URL')?.trim();
    try {
      if (!v) return null;
      // Validate URL shape
      return new URL(v).toString();
    } catch {
      return null;
    }
  }

  // ── Uploads
  getMaxUploadBytes(): number {
    const mb = Number(this.cfg.get<string>('MAX_UPLOAD_MB') ?? '25');
    return (Number.isFinite(mb) && mb > 0 ? mb : 25) * 1024 * 1024;
  }
  getAllowedMime(): string[] {
    return parseCsv(this.cfg.get<string>('ALLOWED_MIME') ?? '');
  }
}
