import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CloudinaryService } from '../common/util/cloudinary';
import { HederaService } from '../hedera/hedera.service';
import { IPFSService } from '../common/util/ipfs-upload';
import { AIService } from '../ai/ai.service';
import { createHash } from 'node:crypto';
import type { CreateProofDto } from './dto/create-proof.dto';

export interface ProofResponse {
  ok: boolean;
  duplicate: boolean;
  proof: {
    id: string;
    userId: string;
    filename: string;
    mimeType: string;
    sha256: string;
    ipType: string | null;
    summary: {
      title: string;
      description: string;
      category: string;
    };
    ipfsCid: string | null;
    hederaTopic: string;
    hederaTxId: string;
    consensusTs: string;
    signerWallet: string | null;
    userSig: string | null;
    createdAt: string;
  };
  warnings?: Array<{ code: string; message: string }>;
}

@Injectable()
export class ProofsService {
  private readonly logger = new Logger(ProofsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly hedera: HederaService,
    private readonly ipfs: IPFSService,
    private readonly ai: AIService,
  ) {}

  async createProof(
    file: Express.Multer.File,
    userId: string,
    userEmail: string,
    dto: CreateProofDto,
    idempotencyKey?: string,
  ): Promise<ProofResponse> {
    const warnings: Array<{ code: string; message: string }> = [];

    // Check idempotency
    if (idempotencyKey) {
      const existing = await this.findIdempotentProof(userId, idempotencyKey);
      if (existing) {
        return this.formatProofResponse(existing, true, warnings);
      }
    }

    // Compute SHA-256
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');

    // Check for duplicates
    const existingProof = await this.prisma.proof.findFirst({
      where: { sha256 },
    });

    if (existingProof) {
      return this.formatProofResponse(existingProof, true, warnings);
    }

    // Validate wallet signature if provided
    if (dto.userSigBase64) {
      if (!dto.signerPubKeyBase64) {
        throw new BadRequestException('signerPubKeyBase64 required when userSigBase64 provided');
      }

      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user?.walletPublicKey || user.walletPublicKey !== dto.signerPubKeyBase64) {
        throw new BadRequestException('Signer public key does not match user wallet');
      }

      // TODO: Implement signature verification
      // For now, assume valid
    }

    // Upload to Cloudinary (always store the file)
    let cloudinaryUrl: string;
    try {
      const result = await this.cloudinary.uploadFile(file);
      cloudinaryUrl = result.secure_url;
    } catch (error) {
      this.logger.error('Cloudinary upload failed', error);
      throw new BadRequestException('File upload failed');
    }

    // Optional IPFS upload
    let ipfsCid: string | null = null;
    if (dto.wantIPFS === 'true') {
      try {
        ipfsCid = await this.ipfs.uploadFile(file.buffer, file.originalname);
        if (!ipfsCid) {
          warnings.push({
            code: 'IPFS_FAILED',
            message: 'IPFS upload failed but proof was created',
          });
        }
      } catch (error) {
        this.logger.error('IPFS upload failed', error);
        warnings.push({ code: 'IPFS_FAILED', message: 'IPFS upload failed but proof was created' });
      }
    }

    // Generate AI metadata
    let summary;
    try {
      summary = await this.ai.generateMetadata(file.originalname, file.mimetype);
    } catch (error) {
      this.logger.error('AI metadata generation failed', error);
      summary = {
        title: file.originalname,
        description: '',
        category: 'other',
      };
    }

    // Submit to Hedera
    const hederaResult = await this.hedera.submitProof({
      sha256,
      ipfsCid,
      filename: file.originalname,
      mimeType: file.mimetype,
      ipType: dto.ipType || null,
      ownerUserId: userId,
      ownerEmail: userEmail,
      signerWallet: dto.signerPubKeyBase64 || null,
      hasUserSignature: !!dto.userSigBase64,
      createdAt: new Date().toISOString(),
    });

    // Create proof in database
    const proof = await this.prisma.proof.create({
      data: {
        userId,
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: BigInt(file.size),
        digestHex: sha256,
        sha256, // Legacy field for compatibility
        ipType: dto.ipType || 'UNKNOWN',
        ipfsCid,
        hederaTxId: hederaResult.txId,
        hederaTopicId: hederaResult.topicId,
        hederaConsensusAt: new Date(hederaResult.consensusTs),
      },
    });

    // Create AI insight record separately
    await this.prisma.proofAIInsight.create({
      data: {
        proofId: proof.id,
        summary: JSON.parse(JSON.stringify(summary)),
        modelUsed: 'gpt-4o-mini-fallback',
      },
    });

    // Store user signature if provided
    if (dto.userSigBase64 && dto.signerPubKeyBase64) {
      await this.prisma.proofSignature.create({
        data: {
          proofId: proof.id,
          signerName: 'User Wallet',
          walletAddr: dto.signerPubKeyBase64,
          signerPubKey: dto.signerPubKeyBase64,
          signatureAlgo: 'ED25519',
          signature: dto.userSigBase64,
        },
      });
    }

    this.logger.log(
      `Proof created: ${proof.id} for user ${userId}, hash ${sha256.slice(0, 10)}...`,
    );

    return this.formatProofResponse(proof, false, warnings);
  }

  private async findIdempotentProof(userId: string, _idempotencyKey: string) {
    // Note: idempotencyKey field may not exist in current schema
    // This is a placeholder implementation
    return await this.prisma.proof.findFirst({
      where: {
        userId,
        // TODO: Add idempotencyKey field to schema or use alternative approach
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
    });
  }

  private formatProofResponse(
    proof: any,
    duplicate: boolean,
    warnings: Array<{ code: string; message: string }>,
  ): ProofResponse {
    const summary = { title: 'Unknown', description: '', category: 'other' };

    return {
      ok: true,
      duplicate,
      proof: {
        id: proof.id || '',
        userId: proof.userId || '',
        filename: proof.filename || '',
        mimeType: proof.mimeType || '',
        sha256: proof.sha256 || proof.digestHex || '',
        ipType: proof.ipType || null,
        summary,
        ipfsCid: proof.ipfsCid || null,
        hederaTopic: proof.hederaTopicId || '',
        hederaTxId: proof.hederaTxId || '',
        consensusTs: proof.hederaConsensusAt?.toISOString() || new Date().toISOString(),
        signerWallet: null, // Will be populated from signature records
        userSig: null, // Will be populated from signature records
        createdAt: proof.createdAt?.toISOString() || new Date().toISOString(),
      },
      ...(warnings.length > 0 && { warnings }),
    };
  }
}
