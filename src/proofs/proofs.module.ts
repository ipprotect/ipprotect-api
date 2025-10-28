import { Module } from '@nestjs/common';
import { ProofsService } from './proofs.service';
import { ProofsController } from './proofs.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AppConfigModule } from '../common/config/app-config.module';
import { CloudinaryService } from '../common/util/cloudinary';
import { HederaService } from '../hedera/hedera.service';
import { IPFSService } from '../common/util/ipfs-upload';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, AppConfigModule, AIModule],
  controllers: [ProofsController],
  providers: [
    ProofsService,
    CloudinaryService,
    HederaService,
    IPFSService,
  ],
  exports: [ProofsService],
})
export class ProofsModule {}
