import { Controller, Get, Headers, HttpCode, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { LegalService } from './legal.service';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Legal')
@Controller('legal')
export class LegalController {
  constructor(private readonly svc: LegalService) {}

  @Get('terms')
  @ApiOkResponse({ description: 'Returns current Terms of Service' })
  @Public()
  @HttpCode(200)
  async getLatest(
    @Headers('x-jurisdiction') j: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const snap = await this.svc.latestFor(j);

    // Strong client caching: ETag/If-None-Match
    const inm = req.headers['if-none-match'];
    if (typeof inm === 'string' && inm === snap.etag) {
      res.status(304);
      return undefined; // no body on 304
    }

    res.setHeader('ETag', snap.etag);
    res.setHeader('Cache-Control', 'public, max-age=60'); // clients may cache for 60s

    return {
      version: snap.version,
      jurisdictionDefault: snap.jurisdictionDefault,
      effectiveAt: snap.effectiveAtISO,
      tosMarkdown: snap.tosMarkdown,
      privacyMarkdown: snap.privacyMarkdown,
    };
  }

  @Get('privacy')
  @ApiOkResponse({ description: 'Returns current Privacy Policy' })
  privacy() {
    return { version: '2025-01', locale: 'en', url: 'https://example.com/privacy' };
  }
}
