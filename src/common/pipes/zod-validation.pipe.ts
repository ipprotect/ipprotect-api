import {
  Injectable,
  PipeTransform,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import type { ZodObject, ZodTypeAny } from 'zod';
import { ZodError } from 'zod';

type ZodSchema = ZodObject<Record<string, ZodTypeAny>>;

// Narrowers / type guards
function hasStaticSchema(meta: unknown): meta is { schema: ZodSchema } {
  // We only accept a function (class constructor) that carries a static `schema`
  if (typeof meta !== 'function') return false;
  const candidate = (meta as { schema?: unknown }).schema;
  return (
    typeof candidate === 'object' && candidate !== null && '_def' in candidate
  );
}

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  // Keep value as `unknown` to enforce validation before use
  transform(value: unknown, { metatype }: ArgumentMetadata) {
    const schema: ZodSchema | null = hasStaticSchema(metatype)
      ? metatype.schema
      : null;
    if (!schema) {
      // No zod schema attached to this DTO; pass through unchanged
      return value;
    }

    try {
      return schema.parse(value);
    } catch (e) {
      if (e instanceof ZodError) {
        const msg = e.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; ');
        throw new BadRequestException({
          error: 'VALIDATION_ERROR',
          message: msg,
        });
      }
      throw e;
    }
  }
}
