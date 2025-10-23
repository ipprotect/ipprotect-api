import { v4 as uuid } from 'uuid';
import type { Request, Response, NextFunction } from 'express';

type RequestWithId = Request & { requestId?: string };

export function requestIdMiddleware(
  req: RequestWithId,
  res: Response,
  next: NextFunction,
) {
  const headerId = (req.header('x-request-id') || '').trim();
  const id = headerId || uuid();

  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
