import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtRefreshStrategy } from './strategies/jwt-refresh.strategy';
import { Argon2Service } from './utils/argon2.service';
import { TokenService } from './utils/token.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AppConfigModule } from '../common/config/app-config.module';

@Module({
  imports: [PassportModule.register({ session: false }), PrismaModule, AppConfigModule],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy, Argon2Service, TokenService],
  exports: [TokenService, AuthService],
})
export class AuthModule {}
