import rateLimit, {
  type Options,
  type Store,
  type ValueDeterminingMiddleware,
} from 'express-rate-limit';
import type { Request, Response, NextFunction } from 'express';
import Redis, { type Redis as IORedis } from 'ioredis';
import type { AppConfigService } from '../config/config.service';

interface AuthenticatedRequest extends Request {
  user?: { id?: string };
}

/* ---------------- Client IP helper (safe string) ---------------- */
function clientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  const fromXff = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim();
  return (
    (fromXff && fromXff.length > 0 && fromXff) || req.ip || req.socket?.remoteAddress || 'unknown'
  );
}

/* ---------------- Minimal ioredis-backed store ------------------ */
class IoRedisRateLimitStore implements Store {
  private client: IORedis;
  private windowMs: number;
  private _prefix = 'rl:';

  constructor(client: IORedis, windowMs: number) {
    this.client = client;
    this.windowMs = windowMs;
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date }> {
    const k = this._prefix + key;
    const count = await this.client.incr(k);
    if (count === 1) await this.client.pexpire(k, this.windowMs);
    const pttl = await this.client.pttl(k);
    const ttlMs = pttl > 0 ? pttl : this.windowMs;
    return { totalHits: count, resetTime: new Date(Date.now() + ttlMs) };
  }

  async decrement(key: string): Promise<void> {
    const k = this._prefix + key;
    const count = await this.client.decr(k);
    if (count <= 0) await this.client.del(k);
  }

  async resetKey(key: string): Promise<void> {
    await this.client.del(this._prefix + key);
  }

  async resetAll(): Promise<void> {
    const stream = this.client.scanStream({ match: `${this._prefix}*`, count: 100 });
    const batch: string[] = [];
    for await (const chunk of stream) {
      for (const k of chunk as string[]) {
        batch.push(k);
        if (batch.length >= 1000) {
          await this.client.del(...batch.splice(0, batch.length));
        }
      }
    }
    if (batch.length) await this.client.del(...batch);
  }
}

/* -------------------- Factory (use AppConfig) ------------------- */
export function makeRateLimiters(cfg: AppConfigService) {
  const windowMs = cfg.getRateWindowMs();
  const isTest = cfg.getNodeEnv() === 'test';

  // Optional Redis (silent fallback to memory)
  let redis: IORedis | null = null;
  const redisUrl = (() => {
    try {
      return cfg.getRedisUrl(); // getter throws if not set
    } catch {
      return null;
    }
  })();

  if (redisUrl) {
    try {
      const client = new Redis(redisUrl, {
        lazyConnect: true,
        enableReadyCheck: true,
        maxRetriesPerRequest: 2,
        connectTimeout: 5_000,
        retryStrategy: (t) => Math.min(1000 * 2 ** t, 30_000),
      });
      // connect async; ignore errors (fallback to memory)
      client.connect().catch(() => {});
      client.on('error', () => undefined);
      client.on('end', () => undefined);
      redis = client;
    } catch {
      redis = null;
    }
  }

  const sharedStore: Store | undefined = redis
    ? new IoRedisRateLimitStore(redis, windowMs)
    : undefined;

  const keyByUserOrIp: ValueDeterminingMiddleware<string> = (req: Request): string => {
    const r = req as AuthenticatedRequest;
    const id = r.user?.id;
    return typeof id === 'string' && id.length > 0 ? id : clientIp(req);
  };

  type HandlerOptions = { statusCode: number };
  function handle429(
    _req: Request,
    res: Response,
    _next: NextFunction,
    opts: HandlerOptions,
  ): void {
    // Add Retry-After to help well-behaved clients back off
    res.setHeader('Retry-After', Math.ceil(windowMs / 1000).toString());
    const traceId = (res.getHeader('x-request-id') as string) || 'N/A';
    res.status(opts.statusCode).type('application/json; charset=utf-8').json({
      error: 'RATE_LIMITED',
      message: 'Too many requests — please wait and try again later.',
      traceId,
    });
  }

  function buildOpts(limit: number, keyed: boolean): Options {
    const base: Partial<Options> = {
      windowMs,
      limit,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: handle429,
      skip: () => isTest,

      // Some @types versions expect these legacy-ish members:
      statusCode: 429,
      message: undefined as unknown as string,
      identifier: (req: Request) => clientIp(req),
      requestPropertyName: 'rateLimit',
      requestWasSuccessful: (_req: Request, res: Response) => res.statusCode < 400,
      skipFailedRequests: false,
      skipSuccessfulRequests: false,
    };

    if (keyed) base.keyGenerator = keyByUserOrIp;
    if (sharedStore) base.store = sharedStore;

    return base as Options;
  }

  const rlAuth = rateLimit(buildOpts(cfg.getRateLimitAuth(), true));
  const rlProofCreate = rateLimit(buildOpts(cfg.getRateLimitProof(), true));
  const rlVerify = rateLimit(buildOpts(cfg.getRateLimitVerify(), true));
  const healthLimiter = rateLimit(buildOpts(cfg.getRateLimitHealth(), false));
  const statusLimiter = rateLimit(buildOpts(cfg.getRateLimitStatus(), false));

  return { rlAuth, rlProofCreate, rlVerify, healthLimiter, statusLimiter };
}
