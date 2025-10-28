import {
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Body,
  Headers,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags, ApiConsumes, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser, JwtUser } from '../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ProofsService } from './proofs.service';
import { CreateProofDto } from './dto/create-proof.dto';

@ApiTags('Proofs')
@ApiBearerAuth('JWT')
@Controller('proofs')
export class ProofsController {
  constructor(private readonly proofsService: ProofsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @HttpCode(201)
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Proof created successfully' })
  @ApiResponse({ status: 200, description: 'Duplicate proof found' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async createProof(
    @UploadedFile() file: Express.Multer.File,
    @Body(new ZodValidationPipe()) dto: CreateProofDto,
    @CurrentUser() user: JwtUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    if (!user?.sub || !user?.email) {
      throw new BadRequestException('Invalid user context');
    }

    return this.proofsService.createProof(
      file,
      user.sub,
      user.email,
      dto,
      idempotencyKey,
    );
  }
}
