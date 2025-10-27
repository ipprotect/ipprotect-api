import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../common/config/config.service';

export interface LegalSnapshot {
  version: string;
  jurisdictionDefault: string;
  effectiveAtISO: string;
  tosMarkdown: string;
  privacyMarkdown: string;
  etag: string;
}

interface CacheEntry {
  value: LegalSnapshot;
  expiresAt: number; // epoch ms
}

/** Typed select ensures TS knows field types (e.g., effectiveAt: Date). */
const legalSelect: Prisma.LegalDocumentSelect = {
  version: true,
  jurisdiction: true,
  effectiveAt: true,
  tosMd: true,
  privacyMd: true,
};

type LegalRow = Prisma.LegalDocumentGetPayload<{ select: typeof legalSelect }>;

function toUpperTrim2to8(s: string): string {
  const v = s.trim().toUpperCase();
  return v.slice(0, 8);
}

function cleanMd(md: string): string {
  return md.replace(/^\uFEFF/, '').trim();
}

function buildEtag(obj: Omit<LegalSnapshot, 'etag'>): string {
  const h = createHash('sha256');
  h.update(obj.version);
  h.update(obj.jurisdictionDefault);
  h.update(obj.effectiveAtISO);
  h.update(obj.tosMarkdown);
  h.update(obj.privacyMarkdown);
  return `"${h.digest('hex').slice(0, 32)}"`;
}

@Injectable()
export class LegalService {
  private readonly log = new Logger(LegalService.name);
  private readonly cache = new Map<string, CacheEntry>();

  private readonly ttlMs: number;
  private readonly fallbackJurisdiction: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: AppConfigService,
  ) {
    const ttlCandidate = this.cfg.getLegalCacheTtlMs();
    this.ttlMs = Number.isFinite(ttlCandidate) && ttlCandidate > 30_000 ? ttlCandidate : 300_000;

    const j = this.cfg.getDefaultJurisdiction();
    this.fallbackJurisdiction = toUpperTrim2to8(j);
  }

  // ---------------------------------------------------------------------------
  // CACHE HELPERS
  // ---------------------------------------------------------------------------

  private getFromCache(key: string): LegalSnapshot | null {
    const hit = this.cache.get(key);
    if (!hit) return null;
    if (hit.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }
    return hit.value;
  }

  private setCache(key: string, value: LegalSnapshot): void {
    this.cache.set(key, { value, expiresAt: Date.now() + this.ttlMs });
  }

  private normJurisdiction(j?: string): string {
    if (!j) return this.fallbackJurisdiction;
    const t = j.trim().toUpperCase();
    const clamped = t.slice(0, 8);
    return clamped.length >= 2 ? clamped : this.fallbackJurisdiction;
  }

  // ---------------------------------------------------------------------------
  // TYPED PRISMA QUERIES (safe)
  // ---------------------------------------------------------------------------

  private async findLatestActiveByJurisdiction(j: string): Promise<LegalRow | null> {
    const query: Prisma.LegalDocumentFindFirstArgs = {
      where: { isActive: true, jurisdiction: j },
      orderBy: { effectiveAt: 'desc' },
      select: legalSelect,
    };
    const row = await this.prisma.legalDocument.findFirst(query);
    return row;
  }

  private async findLatestActiveAny(): Promise<LegalRow | null> {
    const query: Prisma.LegalDocumentFindFirstArgs = {
      where: { isActive: true },
      orderBy: { effectiveAt: 'desc' },
      select: legalSelect,
    };
    const row = await this.prisma.legalDocument.findFirst(query);
    return row;
  }

  // ---------------------------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------------------------

  async latestFor(jurisdiction?: string): Promise<LegalSnapshot> {
    const j = this.normJurisdiction(jurisdiction);
    const cacheKey = `terms:${j}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    // 1. Preferred (jurisdiction match)
    const preferred = await this.findLatestActiveByJurisdiction(j);

    // 2. Fallback (any active)
    const doc = preferred ?? (await this.findLatestActiveAny());

    // 3. Build snapshot (typed and safe)
    const base: Omit<LegalSnapshot, 'etag'> = doc
      ? {
          version: doc.version,
          jurisdictionDefault: doc.jurisdiction,
          effectiveAtISO: doc.effectiveAt.toISOString(),
          tosMarkdown: cleanMd(doc.tosMd),
          privacyMarkdown: cleanMd(doc.privacyMd),
        }
      : {
          version: 'unconfigured',
          jurisdictionDefault: j,
          effectiveAtISO: new Date().toISOString(),
          tosMarkdown: '# Terms of Service\n_This service has not published terms yet._',
          privacyMarkdown: '# Privacy Policy\n_This service has not published a policy yet._',
        };

    const snapshot: LegalSnapshot = { ...base, etag: buildEtag(base) };
    this.setCache(cacheKey, snapshot);
    return snapshot;
  }
}
