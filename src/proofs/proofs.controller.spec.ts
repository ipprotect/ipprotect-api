import { Test, TestingModule } from '@nestjs/testing';
import { ProofsController } from './proofs.controller';
import { ProofsService } from './proofs.service';

describe('ProofsController', () => {
  let controller: ProofsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProofsController],
      providers: [ProofsService],
    }).compile();

    controller = module.get<ProofsController>(ProofsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
