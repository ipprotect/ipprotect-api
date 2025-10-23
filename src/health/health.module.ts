import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { AppConfigModule } from '../common/config/app-config.module';
import { HealthService } from './health.service';
import { PrismaModule } from '../prisma/prisma.module';
@Module({
  imports: [PrismaModule, AppConfigModule],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
