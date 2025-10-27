import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { UserMeResponse } from './dto/user-me.response';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async me(userId: string): Promise<UserMeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        fullName: true,
        jurisdiction: true,
        termsVersionAccepted: true,
        createdAt: true,
        walletPublicKey: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    return {
      id: user.id,
      email: user.email,
      walletPublicKey: user.walletPublicKey ?? null,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
