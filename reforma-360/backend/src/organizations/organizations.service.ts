import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: { organization: true },
    });
    return memberships.map(m => m.organization);
  }

  async create(userId: string, data: { name: string; type?: any }) {
    // 1. Cria a Organização primeiro
    const organization = await this.prisma.organization.create({
      data: {
        name: data.name,
        type: data.type || 'ACCOUNTING_FIRM',
      }
    });

    // 2. Associa o Utilizador como OWNER criando o registo de Membership
    await this.prisma.membership.create({
      data: {
        userId: userId,
        organizationId: organization.id,
        role: 'OWNER',
      }
    });

    return organization;
  }

  async clearData(userId: string, organizationId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId,
        },
      },
    });

    if (!membership) {
      throw new ForbiddenException('Não tem permissão para alterar esta organização.');
    }

    // Apaga simulações e documentos fiscais na mesma transação
    await this.prisma.$transaction([
      this.prisma.taxSimulation.deleteMany({
        where: { organizationId },
      }),
      this.prisma.fiscalDocument.deleteMany({
        where: { organizationId },
      }),
    ]);

    return { message: 'Todos os dados da organização foram limpos com sucesso.' };
  }
}