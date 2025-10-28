import { Test, TestingModule } from '@nestjs/testing';
import { ProofsService } from './proofs.service';

describe('ProofsService', () => {
  let service: ProofsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ProofsService],
    }).compile();

    service = module.get<ProofsService>(ProofsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
