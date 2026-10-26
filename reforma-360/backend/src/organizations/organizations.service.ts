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
    const organization = await this.prisma.organization.create({
      data: {
        name: data.name,
        type: data.type || 'ACCOUNTING_FIRM',
      }
    });

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
      where: { userId_organizationId: { userId, organizationId } },
    });

    if (!membership) throw new ForbiddenException('Não tem permissão para alterar esta organização.');

    await this.prisma.$transaction([
      this.prisma.taxSimulation.deleteMany({ where: { organizationId } }),
      this.prisma.fiscalDocument.deleteMany({ where: { organizationId } }),
    ]);

    return { message: 'Todos os dados da organização foram limpos com sucesso.' };
  }

  async remove(userId: string, organizationId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });

    if (!membership || membership.role !== 'OWNER') {
      throw new ForbiddenException('Apenas o proprietário pode apagar esta organização.');
    }

    // Apaga simulações, documentos, membros e a própria organização de uma vez
    await this.prisma.$transaction([
      this.prisma.taxSimulation.deleteMany({ where: { organizationId } }),
      this.prisma.fiscalDocument.deleteMany({ where: { organizationId } }),
      this.prisma.membership.deleteMany({ where: { organizationId } }),
      this.prisma.organization.delete({ where: { id: organizationId } }),
    ]);

    return { message: 'Organização apagada com sucesso.' };
  }
}