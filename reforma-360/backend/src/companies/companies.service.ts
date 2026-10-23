import { ForbiddenException, Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}
  private async assertMember(userId: string, organizationId: string) {
    const membership = await this.prisma.membership.findUnique({ where: { userId_organizationId: { userId, organizationId } } });
    if (!membership) throw new ForbiddenException('Você não tem acesso a esta organização.');
  }
  async list(userId: string, organizationId?: string) {
    if (!organizationId) throw new NotFoundException('Selecione uma organização.');
    await this.assertMember(userId, organizationId);
    return this.prisma.company.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' } });
  }
  async create(userId: string, dto: CreateCompanyDto) {
    await this.assertMember(userId, dto.organizationId);
    try {
      return await this.prisma.company.create({ data: { name: dto.name.trim(), taxId: dto.taxId, taxRegime: dto.taxRegime, organizationId: dto.organizationId, state: dto.state?.trim(), city: dto.city?.trim() } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Já existe uma empresa com esse CNPJ nesta organização.');
      throw error;
    }
  }
}
