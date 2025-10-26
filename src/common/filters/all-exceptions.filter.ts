import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
type HttpExceptionBody = { error?: string; message?: string | string[] };

function isHttpExceptionBody(val: unknown): val is HttpExceptionBody {
  if (val && typeof val === 'object') {
    const v = val as Record<string, unknown>;
    const msg = v.message;
    const err = v.error;
    const msgOk = typeof msg === 'string' || Array.isArray(msg);
    const errOk = typeof err === 'string' || typeof err === 'undefined';
    return msgOk && errOk;
  }
  return false;
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null;
}

/** Generic guard for upload/size errors without depending on multer */
function isUploadLimitError(val: unknown): val is { code: string; message?: string } {
  if (!isObject(val)) return false;
  const code = val.code;
  return typeof code === 'string' && code.startsWith('LIMIT_');
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { requestId?: string }>();
    const res = ctx.getResponse<Response>();
    const traceId = req?.requestId ?? '-';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'INTERNAL_ERROR';
    let message = 'Unexpected error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      if (isHttpExceptionBody(resp)) {
        const msg = Array.isArray(resp.message) ? resp.message.join('; ') : (resp.message ?? '');
        error = resp.error ?? exception.name ?? 'HTTP_EXCEPTION';
        message = msg || exception.message || message;
      } else {
        error = exception.name ?? error;
        message = exception.message || message;
      }
    } else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      error = 'VALIDATION_ERROR';
      message = exception.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = HttpStatus.BAD_REQUEST;
      error = 'DB_ERROR';
      message = exception.message;

      switch (exception.code) {
        case 'P2002': // Unique constraint
          status = HttpStatus.CONFLICT;
          error = 'CONFLICT';
          message = 'Resource already exists';
          break;
        case 'P2003': // Foreign key constraint
          status = HttpStatus.BAD_REQUEST;
          error = 'FK_CONSTRAINT';
          message = 'Invalid related reference';
          break;
        case 'P2025': // Record not found
          status = HttpStatus.NOT_FOUND;
          error = 'NOT_FOUND';
          message = 'Resource not found';
          break;
        default:
          break;
      }
    } else if (isUploadLimitError(exception)) {
      status = HttpStatus.BAD_REQUEST;
      error = exception.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'UPLOAD_ERROR';
      message =
        exception.message ??
        exception.code
          .replace(/^LIMIT_/, 'Limit ')
          .toLowerCase()
          .replace(/_/g, ' ');
    } else if (isObject(exception) && typeof exception.message === 'string') {
      // Generic object error (keeps linter happy, no any)
      message = exception.message;
      error =
        typeof (exception as { name?: string }).name === 'string'
          ? (exception as { name?: string }).name!
          : error;
    } else if (typeof exception === 'string') {
      message = exception;
    }

    // Compact JSON log without secrets
    this.logger.error(JSON.stringify({ traceId, status, error, message }));

    // Ensure JSON content type (avoid proxy sniffing)
    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    // Minimal redaction (belt-and-suspenders; keep super cheap)
    const redact = (s: string) =>
      s
        .replace(/(api|secret|key)["']?\s*:\s*["'][^"']{4,}["']/gi, '$1:"[redacted]"')
        .replace(/(password|token)["']?\s*:\s*["'][^"']{4,}["']/gi, '$1:"[redacted]"');

    res.status(status).json({
      error,
      message: typeof message === 'string' ? redact(message) : message,
      traceId,
    });
  }
}
