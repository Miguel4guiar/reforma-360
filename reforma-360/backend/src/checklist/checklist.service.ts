import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';

@Injectable()
export class ChecklistService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertMember(userId: string, organizationId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
    });
    if (!membership) throw new ForbiddenException('Você não tem acesso a esta organização.');
  }

  private async assertCompanyBelongs(companyId: string | null | undefined, organizationId: string) {
    if (!companyId) return;
    const company = await this.prisma.company.findFirst({ where: { id: companyId, organizationId }, select: { id: true } });
    if (!company) throw new ForbiddenException('A empresa selecionada não pertence a esta organização.');
  }

  async list(userId: string, organizationId: string, companyId?: string, status?: string) {
    if (!organizationId) throw new NotFoundException('Selecione uma organização.');
    await this.assertMember(userId, organizationId);
    if (companyId) await this.assertCompanyBelongs(companyId, organizationId);
    return this.prisma.checklistItem.findMany({
      where: {
        organizationId,
        ...(companyId ? { companyId } : {}),
        ...(status && ['PENDING', 'IN_PROGRESS', 'COMPLETED'].includes(status) ? { status: status as 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' } : {}),
      },
      include: { company: { select: { id: true, name: true } } },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async create(userId: string, organizationId: string, dto: CreateChecklistItemDto) {
    if (!organizationId) throw new NotFoundException('Selecione uma organização.');
    await this.assertMember(userId, organizationId);
    await this.assertCompanyBelongs(dto.companyId, organizationId);
    return this.prisma.checklistItem.create({
      data: {
        organizationId,
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        category: dto.category?.trim() || 'GERAL',
        companyId: dto.companyId || null,
        status: dto.status || 'PENDING',
        priority: dto.priority || 'MEDIUM',
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        responsible: dto.responsible?.trim() || null,
        evidenceUrl: dto.evidenceUrl?.trim() || null,
      },
      include: { company: { select: { id: true, name: true } } },
    });
  }

  async update(userId: string, id: string, dto: UpdateChecklistItemDto) {
    const current = await this.prisma.checklistItem.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Tarefa não encontrada.');
    await this.assertMember(userId, current.organizationId);
    if (dto.companyId !== undefined) await this.assertCompanyBelongs(dto.companyId, current.organizationId);
    const data: Record<string, any> = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.category !== undefined) data.category = dto.category.trim() || 'GERAL';
    if (dto.companyId !== undefined) data.company = dto.companyId ? { connect: { id: dto.companyId } } : { disconnect: true };
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.responsible !== undefined) data.responsible = dto.responsible?.trim() || null;
    if (dto.evidenceUrl !== undefined) data.evidenceUrl = dto.evidenceUrl?.trim() || null;
    return this.prisma.checklistItem.update({
      where: { id },
      data,
      include: { company: { select: { id: true, name: true } } },
    });
  }

  async remove(userId: string, id: string) {
    const current = await this.prisma.checklistItem.findUnique({ where: { id }, select: { id: true, organizationId: true } });
    if (!current) throw new NotFoundException('Tarefa não encontrada.');
    await this.assertMember(userId, current.organizationId);
    await this.prisma.checklistItem.delete({ where: { id } });
    return { success: true };
  }
}
