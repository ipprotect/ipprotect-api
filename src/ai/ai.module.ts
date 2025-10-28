import { Module } from '@nestjs/common';
import { AIService } from './ai.service';
import { AppConfigModule } from '../common/config/app-config.module';

@Module({
  imports: [AppConfigModule],
  providers: [AIService],
  exports: [AIService],
})
export class AIModule {}
