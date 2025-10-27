import { z } from 'zod';

export class LoginDto {
  static schema = z.object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    deviceId: z.string().max(100).optional(),
  });

  email!: string;
  password!: string;
  deviceId?: string;
}
