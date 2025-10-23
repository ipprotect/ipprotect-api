import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../common/config/config.service';
import Redis, { type Redis as IORedis } from 'ioredis';

type CheckState = 'ok' | 'degraded' | 'down';

type ProbeOk = { ok: true; latencyMs: number };
type ProbeFail = { ok: false; latencyMs: number; error: string };
type Probe = ProbeOk | ProbeFail;

/** Check result shape returned by each subsystem check */
interface CheckResult {
  state: CheckState;
  debug: Probe | { error: 'not_configured' } | { assumed: true };
}

/** Aggregated status snapshot */
export interface StatusSnapshot {
  uptimeSec: number;
  version: string;
  commit: string | null;
  time: string; // ISO
  bootedAt: string; // ISO
  checks: {
    db: CheckState;
    redis: CheckState;
    hedera: CheckState;
    ipfs: CheckState;
    ai: CheckState;
  };
  meta: {
    region: string;
    apiPrefix: string;
  };
}

/** In non-prod we add this block */
export interface StatusSnapshotWithDebug extends StatusSnapshot {
  debug: {
    db: CheckResult['debug'];
    redis: CheckResult['debug'];
    hedera: CheckResult['debug'];
    ipfs: CheckResult['debug'];
    ai: CheckResult['debug'];
  };
}

const notConfigured = (_what: string): CheckResult => ({
  state: 'down',
  debug: { error: 'not_configured' as const },
});

const okAssumed: CheckResult = { state: 'ok', debug: { assumed: true } };

/** Promise that rejects after `ms` with a labeled timeout */
function timeout(ms: number, label: string): Promise<never> {
  return new Promise((_resolve, reject) =>
    setTimeout(() => reject(new Error(`timeout:${label}`)), ms),
  );
}

/** Wraps a promise with a timeout and produces a Probe */
async function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  label: string,
): Promise<Probe> {
  const start = performance.now();
  try {
    await Promise.race([p, timeout(ms, label)]);
    const latencyMs = Math.round(performance.now() - start);
    return { ok: true, latencyMs };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : 'error';
    return { ok: false, latencyMs, error: message };
  }
}

@Injectable()
export class HealthService {
  private readonly bootTime = new Date();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cfg: AppConfigService,
  ) {}

  async getStatusSnapshot(): Promise<StatusSnapshot | StatusSnapshotWithDebug> {
    // Run probes in parallel with short timeouts
    const [dbProbe, redisProbe, hederaProbe, ipfsProbe, aiProbe] =
      await Promise.all([
        this.checkDb(),
        this.checkRedis(),
        this.checkHedera(),
        this.checkIpfs(),
        this.checkAi(),
      ]);

    const checks: StatusSnapshot['checks'] = {
      db: dbProbe.state,
      redis: redisProbe.state,
      hedera: hederaProbe.state,
      ipfs: ipfsProbe.state,
      ai: aiProbe.state,
    };

    const snapshot: StatusSnapshot = {
      uptimeSec: Math.floor(process.uptime()),
      version: process.env.npm_package_version ?? '0.0.0',
      commit: process.env.GIT_COMMIT ?? null,
      time: new Date().toISOString(),
      bootedAt: this.bootTime.toISOString(),
      checks,
      meta: {
        region: process.env.REGION ?? 'local',
        apiPrefix: this.cfg.getApiPrefix(),
      },
    };

    if (process.env.NODE_ENV !== 'production') {
      const withDebug: StatusSnapshotWithDebug = {
        ...snapshot,
        debug: {
          db: dbProbe.debug,
          redis: redisProbe.debug,
          hedera: hederaProbe.debug,
          ipfs: ipfsProbe.debug,
          ai: aiProbe.debug,
        },
      };
      return withDebug;
    }
    return snapshot;
  }

  private async checkDb(): Promise<CheckResult> {
    // $executeRawUnsafe returns number of affected rows; here it just exercises the connection
    const probe = await withTimeout(
      this.prisma.$executeRawUnsafe('SELECT 1'),
      800,
      'db',
    );

    const state: CheckState = probe.ok
      ? probe.latencyMs < 300
        ? 'ok'
        : 'degraded'
      : 'down';

    return { state, debug: probe };
  }

  private async checkRedis(): Promise<CheckResult> {
    const url = this.cfg.getRedisUrl();
    if (!url) return { state: 'down', debug: { error: 'not_configured' } };

    const client: IORedis = new Redis(url, {
      lazyConnect: true,
      connectTimeout: 500,
      maxRetriesPerRequest: 0,
    });

    let num = 0;
    try {
      await client.connect?.();
      const start = performance.now();
      await client.ping();
      const latencyMs = Math.round(performance.now() - start);
      await client.quit();
      num = latencyMs;
      const state: CheckState = latencyMs < 200 ? 'ok' : 'degraded';
      return { state, debug: { ok: true, latencyMs } };
    } catch (err) {
      try {
        await client.quit();
      } catch {
        /* ignore */
      }
      const message = err instanceof Error ? err.message : 'error';
      return {
        state: 'down',
        debug: { ok: false, latencyMs: num, error: message },
      };
    }
  }

  private async checkHedera(): Promise<CheckResult> {
    const accountId = this.cfg.getHederaAccountId();
    const privateKey = this.cfg.getHederaPrivateKey();
    return accountId && privateKey
      ? Promise.resolve(okAssumed)
      : Promise.resolve(notConfigured('accountId_privateKey'));
  }

  private checkIpfs(): Promise<CheckResult> {
    const token = this.cfg.getIpfsToken();
    return token
      ? Promise.resolve(okAssumed)
      : Promise.resolve(notConfigured('ipfs'));
  }

  private checkAi(): Promise<CheckResult> {
    const key = this.cfg.getOpenAiKey();
    return key
      ? Promise.resolve(okAssumed)
      : Promise.resolve(notConfigured('ai'));
  }
}
