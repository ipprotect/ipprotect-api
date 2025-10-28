import { z } from 'zod';

export class CreateProofDto {
  static schema = z.object({
    ipType: z.enum(['COPYRIGHT', 'TRADEMARK', 'PATENT', 'DESIGN', 'UNKNOWN']).optional(),
    wantIPFS: z.enum(['true', 'false']).optional().default('false'),
    userSigBase64: z.string().optional(),
    signerPubKeyBase64: z.string().optional(),
  });

  ipType?: 'COPYRIGHT' | 'TRADEMARK' | 'PATENT' | 'DESIGN' | 'UNKNOWN';
  wantIPFS?: 'true' | 'false';
  userSigBase64?: string;
  signerPubKeyBase64?: string;
}
