import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}
  list(userId: string) { return this.prisma.organization.findMany({ where: { members: { some: { userId } } }, orderBy: { createdAt: 'desc' } }); }
  async create(userId: string, dto: CreateOrganizationDto) {
    return this.prisma.$transaction(async tx => {
      const org = await tx.organization.create({ data: { name: dto.name.trim(), type: dto.type } });
      await tx.membership.create({ data: { userId, organizationId: org.id, role: 'OWNER' } });
      return org;
    });
  }
  async assertMember(userId: string, organizationId: string) {
    const membership = await this.prisma.membership.findUnique({ where: { userId_organizationId: { userId, organizationId } } });
    if (!membership) throw new ForbiddenException('Você não tem acesso a esta organização.');
    return membership;
  }
}
