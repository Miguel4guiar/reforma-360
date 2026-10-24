import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { XMLParser } from 'fast-xml-parser';

type Inputs = {
  revenue: number;
  purchases: number;
  currentRate: number;
  cbsRate: number;
  ibsRate: number;
  reduction: number;
  creditablePurchases: number;
  documentId?: string;
  simulationYear?: number;
  taxRegime?: 'NORMAL' | 'SIMPLES_DAS' | 'SIMPLES_POR_FORA'; // Novo campo de Regime
};

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const numeric = (value: unknown, field: string) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new BadRequestException(`O campo ${field} deve ser um número maior ou igual a zero.`);
  }
  return number;
};

// Linha do tempo da Reforma
function getTransition(year: number) {
  if (year <= 2026) return { cbsMult: 0.1, ibsMult: 0.01, currentMult: 1.0 };
  if (year === 2027 || year === 2028) return { cbsMult: 1.0, ibsMult: 0.01, currentMult: 0.7 };
  if (year === 2029) return { cbsMult: 1.0, ibsMult: 0.1, currentMult: 0.6 };
  if (year === 2030) return { cbsMult: 1.0, ibsMult: 0.2, currentMult: 0.5 };
  if (year === 2031) return { cbsMult: 1.0, ibsMult: 0.3, currentMult: 0.4 };
  if (year === 2032) return { cbsMult: 1.0, ibsMult: 0.4, currentMult: 0.3 };
  return { cbsMult: 1.0, ibsMult: 1.0, currentMult: 0.0 };
}

@Injectable()
export class TaxSimulationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertMember(userId: string, organizationId: string) {
    if (!organizationId) throw new NotFoundException('Selecione uma organização.');
    const membership = await this.prisma.membership.findUnique({ where: { userId_organizationId: { userId, organizationId } } });
    if (!membership) throw new ForbiddenException('Você não tem acesso a esta organização.');
  }

  private calculateManual(raw: Record<string, unknown>) {
    const inputs: Inputs = {
      revenue: numeric(raw.revenue, 'faturamento'),
      purchases: numeric(raw.purchases, 'compras'),
      currentRate: numeric(raw.currentRate, 'alíquota atual'),
      cbsRate: numeric(raw.cbsRate, 'alíquota CBS'),
      ibsRate: numeric(raw.ibsRate, 'alíquota IBS'),
      reduction: numeric(raw.reduction, 'redução'),
      creditablePurchases: numeric(raw.creditablePurchases, 'percentual creditável'),
      simulationYear: raw.simulationYear ? numeric(raw.simulationYear, 'ano de simulação') : 2033,
      taxRegime: (raw.taxRegime as any) || 'NORMAL',
    };
    
    const trans = getTransition(inputs.simulationYear!);
    
    const nominalReformRate = (inputs.cbsRate * trans.cbsMult) + (inputs.ibsRate * trans.ibsMult);
    const effectiveReformRate = nominalReformRate * (1 - inputs.reduction / 100);
    const grossReformTax = round(inputs.revenue * effectiveReformRate / 100);
    const eligiblePurchaseBase = inputs.purchases * inputs.creditablePurchases / 100;
    
    const regime = inputs.taxRegime;
    let finalCurrentTax = 0, netReformTax = 0, estimatedCredits = 0, creditTransferred = 0;

    if (regime === 'SIMPLES_DAS') {
      finalCurrentTax = round(inputs.revenue * inputs.currentRate / 100);
      netReformTax = 0; // Não paga CBS/IBS por fora
      estimatedCredits = 0; // Não deduz créditos nas compras
      creditTransferred = round(finalCurrentTax * 0.33); // Estima-se que só ~33% do DAS é repassado como crédito
    } else if (regime === 'SIMPLES_POR_FORA') {
      // Paga DAS reduzido (sem a fração de consumo) + CBS/IBS cheios
      finalCurrentTax = round(inputs.revenue * (inputs.currentRate * 0.67) / 100);
      estimatedCredits = round(eligiblePurchaseBase * effectiveReformRate / 100);
      netReformTax = round(Math.max(0, grossReformTax - estimatedCredits));
      creditTransferred = round(grossReformTax); // Repassa 100% de crédito para B2B
    } else {
      // NORMAL (Lucro Real / Presumido)
      finalCurrentTax = round(inputs.revenue * (inputs.currentRate * trans.currentMult) / 100);
      estimatedCredits = round(eligiblePurchaseBase * effectiveReformRate / 100);
      netReformTax = round(Math.max(0, grossReformTax - estimatedCredits));
      creditTransferred = round(grossReformTax);
    }
    
    const originalTax = round(inputs.revenue * inputs.currentRate / 100);
    const difference = round((finalCurrentTax + netReformTax) - originalTax);
    
    return {
      currentTax: finalCurrentTax, nominalReformRate: round(nominalReformRate), effectiveReformRate: round(effectiveReformRate),
      grossReformTax: regime === 'SIMPLES_DAS' ? 0 : grossReformTax, eligiblePurchaseBase: round(eligiblePurchaseBase), estimatedCredits, netReformTax, difference,
      differencePercent: originalTax ? round((difference / originalTax) * 100) : null,
      estimatedMarginBeforeTax: round(inputs.revenue - inputs.purchases),
      estimatedMarginAfterCurrentTax: round(inputs.revenue - inputs.purchases - originalTax),
      estimatedMarginAfterReformTax: round(inputs.revenue - inputs.purchases - (finalCurrentTax + netReformTax)),
      creditTransferredToB2B: creditTransferred,
      methodology: `Regime: ${regime}. Ano: ${inputs.simulationYear}. Multiplicadores aplicados.`,
    };
  }

  async list(userId: string, organizationId: string) {
    await this.assertMember(userId, organizationId);
    return this.prisma.taxSimulation.findMany({ where: { organizationId }, orderBy: { createdAt: 'desc' }, take: 100 });
  }

  async create(userId: string, body: { organizationId: string; name: string; inputs: Record<string, unknown> }) {
    await this.assertMember(userId, body.organizationId);
    if (!body.name?.trim()) throw new BadRequestException('Informe um nome para a simulação.');
    const results = this.calculateManual(body.inputs);
    return this.prisma.taxSimulation.create({
      data: { organizationId: body.organizationId, name: body.name.trim().slice(0, 120), inputs: body.inputs as any, results: results as any },
    });
  }

  async createFromDocument(userId: string, body: { organizationId: string; documentId: string; name: string; inputs: Record<string, unknown> }) {
    await this.assertMember(userId, body.organizationId);
    
    const doc = await this.prisma.fiscalDocument.findUnique({ where: { id: body.documentId, organizationId: body.organizationId } });
    if (!doc) throw new NotFoundException('Documento fiscal não encontrado.');
    if (doc.documentType === 'TEXT') throw new BadRequestException('Ficheiros TXT não são suportados para simulação automática.');

    const parser = new XMLParser({ ignoreAttributes: false });
    const parsedXml = parser.parse(doc.rawXml);
    const nfe = parsedXml.nfeProc?.NFe || parsedXml.NFe;
    const ufOrigin = nfe?.infNFe?.emit?.enderEmit?.UF || 'SP';
    const ufDestination = nfe?.infNFe?.dest?.enderDest?.UF || 'SP';
    const cityDestination = nfe?.infNFe?.dest?.enderDest?.xMun || 'Não informada';

    const federal = await this.prisma.federalTaxRate.findUnique({ where: { year: 2026 } });
    const baseCbs = federal ? Number(federal.cbsRate) : 8.8;

    let stateRate = await this.prisma.stateTaxRate.findUnique({ where: { uf: ufDestination } });
    if (!stateRate) stateRate = await this.prisma.stateTaxRate.findUnique({ where: { uf: 'DEFAULT' } });
    const baseIbs = stateRate ? Number(stateRate.ibsRate) : 17.7;

    const ncmRules = await this.prisma.ncmRule.findMany();

    const year = body.inputs.simulationYear ? numeric(body.inputs.simulationYear, 'ano de simulação') : 2033;
    const trans = getTransition(year);
    const finalCbs = baseCbs * trans.cbsMult;
    const finalIbs = baseIbs * trans.ibsMult;

    const items = (doc.items as any[]) || [];
    const docRevenue = Number(doc.totalAmount || 0);
    
    let totalGrossReform = 0, totalCbs = 0, totalIbs = 0;

    const itemsCalculated = items.map((item: any) => {
      const itemTotal = Number(item.total || 0);
      const ncm = String(item.ncm || '00000000').padStart(8, '0');
      
      let reduction = 0;
      const matchedRule = ncmRules.find(rule => ncm.startsWith(rule.ncmPrefix));
      if (matchedRule) reduction = Number(matchedRule.reductionPct);
      
      const effectiveCbs = finalCbs * (1 - reduction / 100);
      const effectiveIbs = finalIbs * (1 - reduction / 100);
      const cbsTax = round(itemTotal * effectiveCbs / 100);
      const ibsTax = round(itemTotal * effectiveIbs / 100);
      const grossTax = round(cbsTax + ibsTax);

      totalGrossReform += grossTax; totalCbs += cbsTax; totalIbs += ibsTax;

      return {
        ...item, ncm,
        appliedRules: { ufOrigin, ufDestination, cityDestination, isReduced: reduction > 0, ruleDescription: matchedRule ? matchedRule.description : null },
        cbsRateApplied: finalCbs, ibsRateApplied: finalIbs,
        currentTax: round(itemTotal * numeric(body.inputs.currentRate, 'alíquota atual') / 100),
        cbsTax, ibsTax, grossReformTax: grossTax,
      };
    });

    const regime = (body.inputs.taxRegime as any) || 'NORMAL';
    const baseCurrentRate = numeric(body.inputs.currentRate, 'alíquota atual');
    const purchases = numeric(body.inputs.purchases, 'compras');
    const creditablePurchases = numeric(body.inputs.creditablePurchases, 'percentual creditável');
    
    const averageEffectiveRate = docRevenue > 0 ? (totalGrossReform / docRevenue) * 100 : 0;
    const eligiblePurchaseBase = purchases * creditablePurchases / 100;
    const rawEstimatedCredits = round(eligiblePurchaseBase * averageEffectiveRate / 100);

    let finalCurrentTax = 0, finalNetReformTax = 0, finalEstimatedCredits = 0, creditTransferred = 0;

    if (regime === 'SIMPLES_DAS') {
      finalCurrentTax = round(docRevenue * baseCurrentRate / 100);
      finalNetReformTax = 0;
      finalEstimatedCredits = 0;
      creditTransferred = round(finalCurrentTax * 0.33);
    } else if (regime === 'SIMPLES_POR_FORA') {
      finalCurrentTax = round(docRevenue * (baseCurrentRate * 0.67) / 100);
      finalEstimatedCredits = rawEstimatedCredits;
      finalNetReformTax = round(Math.max(0, totalGrossReform - finalEstimatedCredits));
      creditTransferred = round(totalGrossReform);
    } else {
      finalCurrentTax = round(docRevenue * (baseCurrentRate * trans.currentMult) / 100);
      finalEstimatedCredits = rawEstimatedCredits;
      finalNetReformTax = round(Math.max(0, totalGrossReform - finalEstimatedCredits));
      creditTransferred = round(totalGrossReform);
    }

    const originalTax = round(docRevenue * baseCurrentRate / 100);
    const difference = round((finalCurrentTax + finalNetReformTax) - originalTax);

    const results = {
      isDocumentSimulation: true,
      currentTax: finalCurrentTax, nominalReformRate: null, effectiveReformRate: round(averageEffectiveRate),
      grossReformTax: regime === 'SIMPLES_DAS' ? 0 : round(totalGrossReform), eligiblePurchaseBase: round(eligiblePurchaseBase), 
      estimatedCredits: finalEstimatedCredits, netReformTax: finalNetReformTax, difference,
      differencePercent: originalTax ? round((difference / originalTax) * 100) : null,
      estimatedMarginBeforeTax: round(docRevenue - purchases),
      estimatedMarginAfterCurrentTax: round(docRevenue - purchases - originalTax),
      estimatedMarginAfterReformTax: round(docRevenue - purchases - (finalCurrentTax + finalNetReformTax)),
      creditTransferredToB2B: creditTransferred,
      methodology: `IBS dinâmico (${baseIbs}%) para ${ufDestination}. Regime: ${regime}. Ano: ${year}.`,
      itemsCalculated
    };

    const finalInputs = { ...body.inputs, documentId: body.documentId, revenue: docRevenue, simulationYear: year, taxRegime: regime };

    return this.prisma.taxSimulation.create({
      data: { organizationId: body.organizationId, name: body.name.trim().slice(0, 120), inputs: finalInputs as any, results: results as any },
    });
  }
}