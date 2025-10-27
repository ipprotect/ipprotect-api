import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Public } from '../common/decorators/public.decorator';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { TokenService } from './utils/token.service';
import { ApiTags } from '@nestjs/swagger';

type CookieMap = Readonly<Record<string, string>>;
type CookieRequest = Request & { cookies?: CookieMap };

function extractRefreshToken(req: CookieRequest): string | null {
  const c = req.cookies;
  const fromCookie = c && typeof c.refresh === 'string' && c.refresh.length > 0 ? c.refresh : null;
  if (fromCookie) return fromCookie;

  const auth = req.get('authorization');
  if (auth?.startsWith('Bearer ')) {
    const t = auth.slice(7).trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly svc: AuthService,
    private readonly tokens: TokenService,
  ) {}

  @Post('signup')
  @Public()
  @HttpCode(200)
  async signup(
    @Body(new ZodValidationPipe()) body: SignupDto,
    @Req() req: CookieRequest,
    @Res({ passthrough: true }) res: Response,
  ) {
    const out = await this.svc.signup({
      ...body,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.cookie('refresh', out.refresh, this.svc.getRefreshCookieOptions());
    return { user: out.user, access: out.access, expiresIn: out.accessTtl };
  }

  @Post('login')
  @Public()
  @HttpCode(200)
  async login(
    @Body(new ZodValidationPipe()) body: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const out = await this.svc.login(body);
    res.cookie('refresh', out.refresh, this.svc.getRefreshCookieOptions());
    return { user: out.user, access: out.access, expiresIn: out.accessTtl };
  }

  @Post('refresh')
  @Public()
  @HttpCode(200)
  async refresh(@Req() req: CookieRequest, @Res({ passthrough: true }) res: Response) {
    const token = extractRefreshToken(req);
    if (!token) return { error: 'UNAUTHORIZED', message: 'Missing refresh token' };

    const decoded = this.tokens.verifyRefresh(token); // returns typed RefreshPayload
    const pair = await this.svc.rotateRefresh(decoded.sub, decoded.jti);

    res.cookie('refresh', pair.refresh, this.svc.getRefreshCookieOptions());
    return { access: pair.access, expiresIn: pair.accessTtl };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: CookieRequest, @Res({ passthrough: true }) res: Response) {
    const token = extractRefreshToken(req);
    if (token) {
      try {
        const dec = this.tokens.verifyRefresh(token);
        await this.svc.logoutAll(dec.sub);
      } catch {
        // ignore malformed/expired token on logout
      }
    }
    res.clearCookie('refresh', this.svc.getRefreshCookieOptions());
    return { ok: true };
  }
}
