import { z } from 'zod';

/** Duration format like 900s, 15m, 12h, 30d */
const durationRegex = /^\d+(s|m|h|d)$/i;

export const envSchema = z.object({
  // Server
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.string().default('4000'),
  API_PREFIX: z.string().default('/api'),
  ALLOWED_ORIGINS: z.string().default(''),

  // JWT
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be 32+ chars'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(32, 'JWT_REFRESH_SECRET must be 32+ chars'),
  JWT_ACCESS_TTL: z
    .string()
    .regex(durationRegex, 'JWT_ACCESS_TTL must look like 900s, 15m, 12h, 30d')
    .default('900s'),
  JWT_REFRESH_TTL: z
    .string()
    .regex(durationRegex, 'JWT_REFRESH_TTL must look like 30d, 7d, 12h, etc.')
    .default('30d'),

  //  Database & Redis
  DATABASE_URL: z
    .string()
    .url('DATABASE_URL must be a valid URL')
    .refine(
      (u) => u.startsWith('postgres'),
      'DATABASE_URL must start with postgres:// or postgresql://',
    ),
  REDIS_URL: z
    .string()
    .url('REDIS_URL must be a valid URL')
    .refine(
      (u) => u.startsWith('redis://') || u.startsWith('rediss://'),
      'REDIS_URL must start with redis://',
    ),

  // Optional providers (warn at runtime if missing)
  HEDERA_ACCOUNT_ID: z.string().optional().default(''),
  HEDERA_PRIVATE_KEY: z.string().optional().default(''),
  HEDERA_TOPIC_ID: z.string().optional().default(''),

  WEB3_STORAGE_TOKEN: z.string().optional().default(''),

  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_MODEL: z.string().optional().default('gpt-4o-mini'),

  PUBLIC_VERIFY_URL: z.string().optional().default(''),

  //─ Uploads
  MAX_UPLOAD_MB: z.string().optional().default('25'),
  ALLOWED_MIME: z
    .string()
    .optional()
    .default(
      'image/png,image/jpeg,application/pdf,text/plain,audio/mpeg,application/zip',
    ),
});

export type RawEnv = z.infer<typeof envSchema>;

/** Validate and normalize process.env -> throws readable error if invalid */
export function validateEnv(raw: NodeJS.ProcessEnv): RawEnv {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  return parsed.data;
}
