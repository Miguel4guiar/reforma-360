import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OrganizationType, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const exists = await this.prisma.user.findUnique({ where: { email } });

    if (exists) {
      throw new ConflictException('Este e-mail já está cadastrado.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: {
            name: dto.name.trim(),
            email,
            passwordHash,
          },
        });

        // Cada novo cadastro cria sua própria organização e recebe acesso
        // somente a ela. Organizações antigas sem membros NÃO são atribuídas
        // automaticamente ao primeiro usuário.
        const organization = await tx.organization.create({
          data: {
            name: dto.organizationName.trim(),
            type: dto.organizationType as OrganizationType,
          },
        });

        await tx.membership.create({
          data: {
            userId: created.id,
            organizationId: organization.id,
            role: 'OWNER',
          },
        });

        return created;
      });

      return this.createSession(user.id, user.name, user.email);
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Este e-mail já está cadastrado.');
      }

      throw error;
    }
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({ where: { email } });
    const valid = user
      ? await bcrypt.compare(dto.password, user.passwordHash)
      : false;

    if (!user || !valid) {
      throw new UnauthorizedException('E-mail ou senha incorretos.');
    }

    return this.createSession(user.id, user.name, user.email);
  }

  private async createSession(userId: string, name: string, email: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      { expiresIn: '8h' },
    );

    const organizations = await this.prisma.membership.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 28800,
      user: { id: userId, name, email },
      organizations: organizations.map((membership) => membership.organization),
    };
  }
}
