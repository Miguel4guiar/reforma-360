import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type Inputs = {
  revenue: number;
  purchases: number;
  currentRate: number;
  cbsRate: number;
  ibsRate: number;
  reduction: number;
  creditablePurchases: number;
};

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const numeric = (value: unknown, field: string) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new BadRequestException(`O campo ${field} deve ser um número maior ou igual a zero.`);
  return number;
};

@Injectable()
export class TaxSimulationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertMember(userId: string, organizationId: string) {
    if (!organizationId) throw new NotFoundException('Selecione uma organização.');
    const membership = await this.prisma.membership.findUnique({ where: { userId_organizationId: { userId, organizationId } } });
    if (!membership) throw new ForbiddenException('Você não tem acesso a esta organização.');
  }

  private calculate(raw: Record<string, unknown>) {
    const inputs: Inputs = {
      revenue: numeric(raw.revenue, 'faturamento'),
      purchases: numeric(raw.purchases, 'compras'),
      currentRate: numeric(raw.currentRate, 'alíquota atual'),
      cbsRate: numeric(raw.cbsRate, 'alíquota CBS'),
      ibsRate: numeric(raw.ibsRate, 'alíquota IBS'),
      reduction: numeric(raw.reduction, 'redução'),
      creditablePurchases: numeric(raw.creditablePurchases, 'percentual de compras creditáveis'),
    };
    if (inputs.currentRate > 100 || inputs.cbsRate > 100 || inputs.ibsRate > 100 || inputs.reduction > 100 || inputs.creditablePurchases > 100) {
      throw new BadRequestException('Alíquotas, redução e percentual de compras creditáveis devem estar entre 0 e 100.');
    }
    const currentTax = round(inputs.revenue * inputs.currentRate / 100);
    const nominalReformRate = inputs.cbsRate + inputs.ibsRate;
    const effectiveReformRate = nominalReformRate * (1 - inputs.reduction / 100);
    const grossReformTax = round(inputs.revenue * effectiveReformRate / 100);
    const eligiblePurchaseBase = inputs.purchases * inputs.creditablePurchases / 100;
    const estimatedCredits = round(eligiblePurchaseBase * effectiveReformRate / 100);
    const netReformTax = round(Math.max(0, grossReformTax - estimatedCredits));
    const difference = round(netReformTax - currentTax);
    return {
      currentTax, nominalReformRate: round(nominalReformRate), effectiveReformRate: round(effectiveReformRate),
      grossReformTax, eligiblePurchaseBase: round(eligiblePurchaseBase), estimatedCredits,
      netReformTax, difference, differencePercent: currentTax ? round((difference / currentTax) * 100) : null,
      estimatedMarginBeforeTax: round(inputs.revenue - inputs.purchases),
      estimatedMarginAfterCurrentTax: round(inputs.revenue - inputs.purchases - currentTax),
      estimatedMarginAfterReformTax: round(inputs.revenue - inputs.purchases - netReformTax),
      methodology: 'Estimativa simplificada: tributo atual = faturamento × alíquota atual; CBS/IBS = faturamento × (CBS + IBS) ajustado pela redução; crédito estimado = compras × percentual creditável × alíquota efetiva. Não contempla todas as regras, exceções, regimes ou limitações legais.',
    };
  }

  async list(userId: string, organizationId: string) {
    await this.assertMember(userId, organizationId);
    return this.prisma.taxSimulation.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async create(userId: string, body: { organizationId: string; name: string; inputs: Record<string, unknown> }) {
    await this.assertMember(userId, body.organizationId);
    if (!body.name?.trim()) throw new BadRequestException('Informe um nome para a simulação.');
    if (!body.inputs || typeof body.inputs !== 'object' || Array.isArray(body.inputs)) throw new BadRequestException('Informe os parâmetros da simulação.');
    const results = this.calculate(body.inputs);
    return this.prisma.taxSimulation.create({
      data: { organizationId: body.organizationId, name: body.name.trim().slice(0, 120), inputs: body.inputs as any, results: results as any },
    });
  }
}
