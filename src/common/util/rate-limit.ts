import rateLimit from 'express-rate-limit';

export const rlAuth = rateLimit({
  windowMs: 60_000, // 1 minute
  limit: 10, // 10 req/min/IP
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

export const rlProofCreate = rateLimit({
  windowMs: 60_000,
  limit: 6, // per-user ideally; IP fallback is okay at edge
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

export const rlVerify = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
});

export const healthLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

export const statusLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});
