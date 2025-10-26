import { Controller, Get, HttpCode, UnauthorizedException, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import type { UserMeResponse } from './dto/user-me.response';

@ApiTags('Users')
@ApiBearerAuth('JWT')
@Controller('users')
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(200)
  @ApiOkResponse({ description: 'Returns the authenticated user profile' })
  async me(@CurrentUser() user: JwtUser | undefined): Promise<UserMeResponse> {
    if (!user?.sub) throw new UnauthorizedException();
    return this.svc.me(user.sub);
  }
}
