import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable, tap } from 'rxjs';

interface HasRequestId {
  requestId?: string;
}
interface HasUser {
  user?: { sub?: string };
}
interface WithOriginalUrl {
  originalUrl?: string;
}

function getErrStatus(err: unknown, fallback: number): number {
  if (
    typeof err === 'object' &&
    err !== null &&
    'status' in err &&
    typeof (err as { status?: unknown }).status === 'number'
  ) {
    return (err as { status: number }).status;
  }
  return fallback;
}

function getErrName(err: unknown): string {
  if (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    typeof (err as { name?: unknown }).name === 'string'
  ) {
    return (err as { name: string }).name;
  }
  return 'Error';
}

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & HasRequestId & HasUser & WithOriginalUrl>();
    const res = http.getResponse<Response>();

    const start = process.hrtime.bigint();

    const method: string = req.method;
    const url: string = req.originalUrl ?? req.url;
    const requestId: string = req.requestId ?? '-';
    const userId: string | null = req.user?.sub ?? null;

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Number((process.hrtime.bigint() - start) / 1_000_000n);
          const status = res.statusCode;
          // pull safe client IP (copy of helper to avoid cross-import)
          const ip =
            (Array.isArray(req.headers['x-forwarded-for'])
              ? req.headers['x-forwarded-for'][0]
              : req.headers['x-forwarded-for']
            )
              ?.toString()
              .split(',')[0]
              .trim() ||
            req.ip ||
            req.socket?.remoteAddress ||
            'unknown';

          const contentLength = Number(res.getHeader('content-length') ?? 0);

          this.logger.log(
            JSON.stringify({
              requestId,
              method,
              url,
              status,
              ms,
              userId,
              ip,
              contentLength,
            }),
          );
        },
        error: (err: unknown) => {
          const ms = Number((process.hrtime.bigint() - start) / 1_000_000n);
          const status = res.statusCode || getErrStatus(err, 500);
          const errName = getErrName(err);
          const ip =
            (Array.isArray(req.headers['x-forwarded-for'])
              ? req.headers['x-forwarded-for'][0]
              : req.headers['x-forwarded-for']
            )
              ?.toString()
              .split(',')[0]
              .trim() ||
            req.ip ||
            req.socket?.remoteAddress ||
            'unknown';

          const contentLength = Number(res.getHeader('content-length') ?? 0);

          this.logger.error(
            JSON.stringify({
              requestId,
              method,
              url,
              status,
              ms,
              userId,
              error: errName,
              ip,
              contentLength,
            }),
          );
        },
      }),
    );
  }
}
