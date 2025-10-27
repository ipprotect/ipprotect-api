import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

@Injectable()
export class Argon2Service {
  hash(data: string): Promise<string> {
    return argon2.hash(data);
  }
  verify(hash: string, data: string): Promise<boolean> {
    return argon2.verify(hash, data);
  }
}
