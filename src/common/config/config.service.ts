import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService as NestConfig } from '@nestjs/config';
import { readFileSync } from 'fs';
import { join } from 'path';

function parseCsv(input: string | undefined): string[] {
  if (!input) return [];
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
function parseDurationToMs(input: string): number {
  const m = /^(\d+)(s|m|h|d)$/i.exec(input.trim());
  if (m) {
    const n = Number(m[1]);
    const unit = m[2].toLowerCase();
    const factor =
      unit === 's' ? 1_000 : unit === 'm' ? 60_000 : unit === 'h' ? 3_600_000 : 86_400_000;
    return n * factor;
  }
  const asNum = Number(input);
  if (Number.isFinite(asNum)) return asNum * 1_000; // assume seconds if plain number
  // safe default (15m)
  return 900_000;
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
    if (!this.getOpenAiKey()) this.logger.log('AI disabled: OPENAI_API_KEY not set');
    if (!this.getIpfsToken()) this.logger.log('IPFS disabled: WEB3_STORAGE_TOKEN not set');
    if (!this.getHederaPrivateKey() || !this.getHederaAccountId())
      this.logger.log('Hedera disabled: HEDERA_ACCOUNT_ID / HEDERA_PRIVATE_KEY not set');
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

  // ── JWT (Asymmetric RS256 / EdDSA)
  getAccessPrivateKey(): string {
    const file = this.cfg.get<string>('ACCESS_JWT_PRIVATE_KEY_FILE');
    if (file) return readFileSync(join(process.cwd(), file), 'utf8');
    return this.cfg.getOrThrow<string>('ACCESS_JWT_PRIVATE_KEY');
  }

  getAccessPublicKey(): string {
    const file = this.cfg.get<string>('ACCESS_JWT_PUBLIC_KEY_FILE');
    if (file) return readFileSync(join(process.cwd(), file), 'utf8');
    return this.cfg.getOrThrow<string>('ACCESS_JWT_PUBLIC_KEY');
  }

  getRefreshPrivateKey(): string {
    const file = this.cfg.get<string>('REFRESH_JWT_PRIVATE_KEY_FILE');
    if (file) return readFileSync(join(process.cwd(), file), 'utf8');
    return this.cfg.getOrThrow<string>('REFRESH_JWT_PRIVATE_KEY');
  }

  getRefreshPublicKey(): string {
    const file = this.cfg.get<string>('REFRESH_JWT_PUBLIC_KEY_FILE');
    if (file) return readFileSync(join(process.cwd(), file), 'utf8');
    return this.cfg.getOrThrow<string>('REFRESH_JWT_PUBLIC_KEY');
  }

  getJwtAccessTtl(): string {
    return this.cfg.get<string>('JWT_ACCESS_TTL', '900s');
  }
  getJwtRefreshTtl(): string {
    return this.cfg.get<string>('JWT_REFRESH_TTL', '30d');
  }

  /** Typed helpers — never any/unknown */
  getJwtAccessTtlMs(): number {
    return parseDurationToMs(this.getJwtAccessTtl());
  }
  getJwtRefreshTtlMs(): number {
    return parseDurationToMs(this.getJwtRefreshTtl());
  }

  /** If you also need seconds for jsonwebtoken.expiresIn (number) */
  getJwtAccessTtlSeconds(): number {
    return Math.floor(this.getJwtAccessTtlMs() / 1000);
  }
  getJwtRefreshTtlSeconds(): number {
    return Math.floor(this.getJwtRefreshTtlMs() / 1000);
  }

  getCookieDomain(): string {
    return this.cfg.get<string>('COOKIE_DOMAIN', 'localhost');
  }

  // src/common/config/config.service.ts
  getLegalCacheTtlMs(): number {
    // prefer validated config; otherwise fallback
    const v = Number(this.cfg.get('LEGAL_CACHE_TTL_MS') ?? 300_000);
    return Number.isFinite(v) && v > 30_000 ? v : 300_000; // min 30s
  }

  getDefaultJurisdiction(): string {
    const raw = this.cfg.get<string>('DEFAULT_JURISDICTION') ?? 'NIG';
    const t = raw.trim().toUpperCase();
    // clamp to 2..8 chars
    return t.slice(0, 8) || 'NIG';
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

  // ── Proxy / client IP
  getTrustProxy(): boolean | number | string {
    const raw = (this.cfg.get<string>('TRUST_PROXY') ?? '0').trim();

    // booleans
    const lower = raw.toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;

    const n = Number(raw);
    if (Number.isFinite(n)) return n;
    return raw;
  }

  // ── Rate limiting
  getRateWindowMs(): number {
    const v = Number(this.cfg.get<string>('RATE_WINDOW_MS') ?? '60000');
    return Number.isFinite(v) && v > 0 ? v : 60000;
  }
  getRateLimitAuth(): number {
    const v = Number(this.cfg.get<string>('RATE_LIMIT_AUTH') ?? '10');
    return Number.isFinite(v) ? v : 10;
  }
  getRateLimitProof(): number {
    const v = Number(this.cfg.get<string>('RATE_LIMIT_PROOF') ?? '6');
    return Number.isFinite(v) ? v : 6;
  }
  getRateLimitVerify(): number {
    const v = Number(this.cfg.get<string>('RATE_LIMIT_VERIFY') ?? '20');
    return Number.isFinite(v) ? v : 20;
  }
  getRateLimitHealth(): number {
    const v = Number(this.cfg.get<string>('RATE_LIMIT_HEALTH') ?? '60');
    return Number.isFinite(v) ? v : 60;
  }
  getRateLimitStatus(): number {
    const v = Number(this.cfg.get<string>('RATE_LIMIT_STATUS') ?? '30');
    return Number.isFinite(v) ? v : 30;
  }
}
