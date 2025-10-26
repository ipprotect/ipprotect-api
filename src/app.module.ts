import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './common/config/app-config.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { LegalModule } from './legal/legal.module'; // create if not present

@Module({
  imports: [AppConfigModule, PrismaModule, HealthModule, AuthModule, UsersModule, LegalModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
