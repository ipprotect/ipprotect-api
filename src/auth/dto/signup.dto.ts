import { z } from 'zod';

export class SignupDto {
  static schema = z.object({
    email: z.string().email(),
    password: z.string().min(8).max(128),
    fullName: z.string().min(2).max(120).optional(),
    jurisdiction: z.string().min(2).max(8).optional(),
    termsVersionAccepted: z.string().min(1),
    deviceId: z.string().max(100).optional(),
  });

  email!: string;
  password!: string;
  fullName?: string;
  jurisdiction?: string;
  termsVersionAccepted!: string;
  deviceId?: string;
}
