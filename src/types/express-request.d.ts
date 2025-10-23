// src/types/express-request.d.ts
import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    /** Per-request correlation id (also returned as X-Request-Id) */
    requestId?: string;
    /** Optional JWT-sub injected by auth guard later */
    user?: { sub?: string };
    /** Express adds this, but base typing may miss it in some setups */
    originalUrl?: string;
  }
}
