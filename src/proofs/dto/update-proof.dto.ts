import { PartialType } from '@nestjs/swagger';
import { CreateProofDto } from './create-proof.dto';

export class UpdateProofDto extends PartialType(CreateProofDto) {}
