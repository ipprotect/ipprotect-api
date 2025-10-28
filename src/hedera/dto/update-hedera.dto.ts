import { PartialType } from '@nestjs/swagger';
import { CreateHederaDto } from './create-hedera.dto';

export class UpdateHederaDto extends PartialType(CreateHederaDto) {}
