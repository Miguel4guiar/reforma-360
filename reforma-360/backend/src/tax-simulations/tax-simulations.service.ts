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
  purchaseDocumentIds?: string[];
  simulationYear?: number;
  taxRegime?: 'NORMAL' | 'SIMPLES_DAS' | 'SIMPLES_POR_FORA';
  sector?: 'GERAL' | 'PROFISSIONAL_LIBERAL' | 'SAUDE_EDUCACAO';
};

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const numeric = (value: unknown, field: string) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new BadRequestException(`O campo ${field} deve ser um número maior ou igual a zero.`);
  }
  return number;
};

// Linha do tempo da Reforma (EC 132/23)
function getTransition(year: number) {
  if (year <= 2026) return { cbsMult: 0.1, ibsMult: 0.01, currentMult: 1.0 };
  if (year === 2027 || year === 2028) return { cbsMult: 1.0, ibsMult: 0.01, currentMult: 0.7 };
  if (year === 2029) return { cbsMult: 1.0, ibsMult: 0.1, currentMult: 0.6 };
  if (year === 2030) return { cbsMult: 1.0, ibsMult: 0.2, currentMult: 0.5 };
  if (year === 2031) return { cbsMult: 1.0, ibsMult: 0.3, currentMult: 0.4 };
  if (year === 2032) return { cbsMult: 1.0, ibsMult: 0.4, currentMult: 0.3 };
  return { cbsMult: 1.0, ibsMult: 1.0, currentMult: 0.0 };
}

// Retorna o percentual de redução baseado no Setor
function getSectorReduction(sector?: string): number {
  if (sector === 'PROFISSIONAL_LIBERAL') return 30; // Redução de 30%
  if (sector === 'SAUDE_EDUCACAO') return 60; // Redução de 60%
  return 0; // Regra Geral (sem redução)
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
      reduction: numeric(raw.reduction, 'redução manual NCM'),
      creditablePurchases: numeric(raw.creditablePurchases, 'percentual creditável'),
      simulationYear: raw.simulationYear ? numeric(raw.simulationYear, 'ano de simulação') : 2033,
      taxRegime: (raw.taxRegime as any) || 'NORMAL',
      sector: (raw.sector as any) || 'GERAL',
    };
    
    const trans = getTransition(inputs.simulationYear!);
    const sectorReduction = getSectorReduction(inputs.sector);
    const finalReduction = Math.max(inputs.reduction, sectorReduction);
    
    const nominalReformRate = (inputs.cbsRate * trans.cbsMult) + (inputs.ibsRate * trans.ibsMult);
    const effectiveReformRate = nominalReformRate * (1 - finalReduction / 100);
    const grossReformTax = round(inputs.revenue * effectiveReformRate / 100);
    const eligiblePurchaseBase = inputs.purchases * inputs.creditablePurchases / 100;
    
    const regime = inputs.taxRegime;
    let finalCurrentTax = 0, netReformTax = 0, estimatedCredits = 0, creditTransferred = 0;

    if (regime === 'SIMPLES_DAS') {
      finalCurrentTax = round(inputs.revenue * inputs.currentRate / 100);
      netReformTax = 0;
      estimatedCredits = 0;
      creditTransferred = round(finalCurrentTax * 0.33);
    } else if (regime === 'SIMPLES_POR_FORA') {
      finalCurrentTax = round(inputs.revenue * (inputs.currentRate * 0.67) / 100);
      estimatedCredits = round(eligiblePurchaseBase * effectiveReformRate / 100);
      netReformTax = round(Math.max(0, grossReformTax - estimatedCredits));
      creditTransferred = round(grossReformTax);
    } else {
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
      methodology: `Setor: ${inputs.sector} (Redução: ${sectorReduction}%). Regime: ${regime}. Estimativa manual.`,
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
    if (!doc) throw new NotFoundException('Documento fiscal de venda não encontrado.');
    if (doc.documentType === 'TEXT') throw new BadRequestException('Ficheiros TXT não suportados.');

    const purchaseIds = Array.isArray(body.inputs.purchaseDocumentIds) ? body.inputs.purchaseDocumentIds : [];
    const purchaseDocs = purchaseIds.length > 0 
      ? await this.prisma.fiscalDocument.findMany({ where: { id: { in: purchaseIds }, organizationId: body.organizationId } })
      : [];

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
    const sector = (body.inputs.sector as string) || 'GERAL';
    const sectorReduction = getSectorReduction(sector);

    const finalCbs = baseCbs * trans.cbsMult;
    const finalIbs = baseIbs * trans.ibsMult;

    // CÁLCULO DAS VENDAS
    const items = (doc.items as any[]) || [];
    const docRevenue = Number(doc.totalAmount || 0);
    
    let totalGrossReform = 0, totalCbs = 0, totalIbs = 0;
    let totalRealIcms = 0, totalRealPis = 0, totalRealCofins = 0; // Acumuladores dos impostos reais

    const itemsCalculated = items.map((item: any) => {
      const itemTotal = Number(item.total || 0);
      const ncm = String(item.ncm || '00000000').padStart(8, '0');
      
      // Captura os impostos reais processados pelo upload
      const itemIcms = Number(item.vICMS || 0);
      const itemPis = Number(item.vPIS || 0);
      const itemCofins = Number(item.vCOFINS || 0);
      const itemRealTax = itemIcms + itemPis + itemCofins;

      totalRealIcms += itemIcms;
      totalRealPis += itemPis;
      totalRealCofins += itemCofins;

      let ncmReduction = 0;
      const matchedRule = ncmRules.find(rule => ncm.startsWith(rule.ncmPrefix));
      if (matchedRule) ncmReduction = Number(matchedRule.reductionPct);
      
      const appliedReduction = Math.max(ncmReduction, sectorReduction);
      const effectiveCbs = finalCbs * (1 - appliedReduction / 100);
      const effectiveIbs = finalIbs * (1 - appliedReduction / 100);
      const grossTax = round(itemTotal * (effectiveCbs + effectiveIbs) / 100);

      totalGrossReform += grossTax; 
      totalCbs += round(itemTotal * effectiveCbs / 100); 
      totalIbs += round(itemTotal * effectiveIbs / 100);

      return {
        ...item, ncm,
        appliedRules: { ufOrigin, ufDestination, cityDestination, isReduced: appliedReduction > 0, ruleDescription: matchedRule ? matchedRule.description : (sectorReduction > 0 ? `Redução de Setor (${sectorReduction}%)` : null) },
        cbsRateApplied: finalCbs, ibsRateApplied: finalIbs,
        // Substituindo o cálculo cego pelo valor real do XML:
        currentTax: itemRealTax > 0 ? round(itemRealTax) : round(itemTotal * numeric(body.inputs.currentRate, 'alíquota atual') / 100),
        vICMS: itemIcms, vPIS: itemPis, vCOFINS: itemCofins,
        cbsTax: round(itemTotal * effectiveCbs / 100), ibsTax: round(itemTotal * effectiveIbs / 100), grossReformTax: grossTax,
      };
    });

    const totalRealOriginalTax = round(totalRealIcms + totalRealPis + totalRealCofins);

    // CÁLCULO DAS COMPRAS REAIS
    let exactCreditsTotal = 0;
    let realPurchasesVolume = 0;
    const hasRealPurchases = purchaseDocs.length > 0;

    if (hasRealPurchases) {
      for (const pDoc of purchaseDocs) {
        if (pDoc.documentType === 'TEXT') continue;
        const pParsedXml = parser.parse(pDoc.rawXml);
        const pNfe = pParsedXml.nfeProc?.NFe || pParsedXml.NFe;
        const pUfDestination = pNfe?.infNFe?.dest?.enderDest?.UF || 'SP';

        let pStateRate = await this.prisma.stateTaxRate.findUnique({ where: { uf: pUfDestination } });
        if (!pStateRate) pStateRate = await this.prisma.stateTaxRate.findUnique({ where: { uf: 'DEFAULT' } });
        const pFinalIbs = (pStateRate ? Number(pStateRate.ibsRate) : 17.7) * trans.ibsMult;

        realPurchasesVolume += Number(pDoc.totalAmount || 0);
        const pItems = (pDoc.items as any[]) || [];

        for (const item of pItems) {
          const itemTotal = Number(item.total || 0);
          const ncm = String(item.ncm || '00000000').padStart(8, '0');
          let ncmReduction = 0;
          const matchedRule = ncmRules.find(rule => ncm.startsWith(rule.ncmPrefix));
          if (matchedRule) ncmReduction = Number(matchedRule.reductionPct);
          
          const appliedReduction = Math.max(ncmReduction, sectorReduction);
          const effectiveCbs = finalCbs * (1 - appliedReduction / 100);
          const effectiveIbs = pFinalIbs * (1 - appliedReduction / 100);
          exactCreditsTotal += round(itemTotal * (effectiveCbs + effectiveIbs) / 100);
        }
      }
    }

    const regime = (body.inputs.taxRegime as any) || 'NORMAL';
    const baseCurrentRate = numeric(body.inputs.currentRate, 'alíquota atual');
    const finalPurchasesVolume = hasRealPurchases ? realPurchasesVolume : numeric(body.inputs.purchases, 'compras');
    const averageEffectiveRate = docRevenue > 0 ? (totalGrossReform / docRevenue) * 100 : 0;
    
    let baseCredits = 0;
    if (hasRealPurchases) {
      baseCredits = exactCreditsTotal;
    } else {
      const creditablePurchases = numeric(body.inputs.creditablePurchases, 'percentual creditável');
      baseCredits = round((finalPurchasesVolume * creditablePurchases / 100) * averageEffectiveRate / 100);
    }

    // Calcula o imposto original: usa o real (se existir) ou o manual (se o XML estiver zerado)
    const calculatedManualTax = round(docRevenue * baseCurrentRate / 100);
    const originalTax = totalRealOriginalTax > 0 ? totalRealOriginalTax : calculatedManualTax;

    let finalCurrentTax = 0, finalNetReformTax = 0, finalEstimatedCredits = 0, creditTransferred = 0;

    if (regime === 'SIMPLES_DAS') {
      finalCurrentTax = calculatedManualTax;
      finalNetReformTax = 0;
      finalEstimatedCredits = 0;
      creditTransferred = round(finalCurrentTax * 0.33);
    } else if (regime === 'SIMPLES_POR_FORA' || regime === 'NORMAL') {
      finalCurrentTax = regime === 'SIMPLES_POR_FORA' ? round(calculatedManualTax * 0.67) : round(originalTax * trans.currentMult);
      finalEstimatedCredits = baseCredits;
      finalNetReformTax = round(Math.max(0, totalGrossReform - finalEstimatedCredits));
      creditTransferred = round(totalGrossReform);
    }

    const difference = round((finalCurrentTax + finalNetReformTax) - originalTax);

    const results = {
      isDocumentSimulation: true,
      hasRealPurchases,
      currentTax: finalCurrentTax, nominalReformRate: null, effectiveReformRate: round(averageEffectiveRate),
      grossReformTax: regime === 'SIMPLES_DAS' ? 0 : round(totalGrossReform), 
      eligiblePurchaseBase: finalPurchasesVolume, 
      estimatedCredits: finalEstimatedCredits, 
      netReformTax: finalNetReformTax, difference,
      differencePercent: originalTax ? round((difference / originalTax) * 100) : null,
      estimatedMarginBeforeTax: round(docRevenue - finalPurchasesVolume),
      estimatedMarginAfterCurrentTax: round(docRevenue - finalPurchasesVolume - originalTax),
      estimatedMarginAfterReformTax: round(docRevenue - finalPurchasesVolume - (finalCurrentTax + finalNetReformTax)),
      creditTransferredToB2B: creditTransferred,
      methodology: `Setor: ${sector}. Regime: ${regime}. Créditos: ${hasRealPurchases ? 'Exatos via XML' : 'Estimativa'}.`,
      
      // NOVA ABA: O detalhe exato do imposto antigo para mostrarmos no visual Antes/Depois
      originalTaxBreakdown: {
        icms: round(totalRealIcms),
        pis: round(totalRealPis),
        cofins: round(totalRealCofins),
        total: originalTax
      },
      
      itemsCalculated
    };

    const finalInputs = { ...body.inputs, documentId: body.documentId, purchaseDocumentIds: purchaseIds, revenue: docRevenue, purchases: finalPurchasesVolume, simulationYear: year, taxRegime: regime, sector };

    return this.prisma.taxSimulation.create({
      data: { organizationId: body.organizationId, name: body.name.trim().slice(0, 120), inputs: finalInputs as any, results: results as any },
    });
  }
}