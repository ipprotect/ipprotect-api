import { Module } from '@nestjs/common';
import { LegalService } from './legal.service';
import { LegalController } from './legal.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AppConfigModule } from '../common/config/app-config.module';

@Module({
  imports: [PrismaModule, AppConfigModule],
  controllers: [LegalController],
  providers: [LegalService],
  exports: [LegalService],
})
export class LegalModule {}
