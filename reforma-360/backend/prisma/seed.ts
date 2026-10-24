import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('A iniciar o carregamento das regras tributárias...');

  // 1. Taxa Federal (CBS) - Alíquota de referência
  await prisma.federalTaxRate.upsert({
    where: { year: 2026 },
    update: {},
    create: { year: 2026, cbsRate: 8.8 }, 
  });

  // 2. Taxas Estaduais (IBS)
  const ufs = [
    { uf: 'SP', ibsRate: 17.5 }, { uf: 'RJ', ibsRate: 18.2 },
    { uf: 'MG', ibsRate: 18.0 }, { uf: 'RS', ibsRate: 17.8 },
    { uf: 'PR', ibsRate: 17.7 }, { uf: 'SC', ibsRate: 17.7 },
    { uf: 'BA', ibsRate: 17.7 }, { uf: 'DEFAULT', ibsRate: 17.7 }
  ];

  for (const state of ufs) {
    await prisma.stateTaxRate.upsert({
      where: { uf: state.uf },
      update: { ibsRate: state.ibsRate },
      create: { uf: state.uf, ibsRate: state.ibsRate },
    });
  }

  // 3. Regras de NCM (Exceções e Reduções)
  const ncmRules = [
    { ncmPrefix: '3003', description: 'Medicamentos', reductionPct: 60.0, isExempt: false },
    { ncmPrefix: '3004', description: 'Medicamentos', reductionPct: 60.0, isExempt: false },
    { ncmPrefix: '0401', description: 'Leite (Cesta Básica)', reductionPct: 100.0, isExempt: true },
    { ncmPrefix: '1006', description: 'Arroz (Cesta Básica)', reductionPct: 100.0, isExempt: true },
  ];

  for (const rule of ncmRules) {
    await prisma.ncmRule.upsert({
      where: { ncmPrefix: rule.ncmPrefix },
      update: { reductionPct: rule.reductionPct, isExempt: rule.isExempt, description: rule.description },
      create: { ncmPrefix: rule.ncmPrefix, description: rule.description, reductionPct: rule.reductionPct, isExempt: rule.isExempt },
    });
  }

  console.log('Regras tributárias carregadas com sucesso na base de dados!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });