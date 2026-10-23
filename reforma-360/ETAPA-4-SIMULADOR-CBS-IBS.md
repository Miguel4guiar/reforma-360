# Etapa 4 — Simulador CBS / IBS

## O que foi adicionado
- Nova tela `/simulador`, responsiva, com cálculo instantâneo e comparação entre cenário atual e cenário simplificado CBS/IBS.
- Parâmetros editáveis: faturamento, compras, alíquota atual estimada, alíquotas de referência CBS/IBS, redução e percentual de compras potencialmente creditáveis.
- Estimativa de tributo bruto, créditos, tributo líquido, diferença e impacto simplificado na margem.
- Memória de cálculo visível na tela.
- Histórico de cenários salvo por organização, protegido por autenticação e verificação de associação.
- Nova tabela `TaxSimulation` e migração incremental.

## Instalação
1. Faça uma cópia de segurança normal do projeto e preserve o `.env` existente.
2. Copie os arquivos do ZIP mantendo os caminhos e sem remover os arquivos atuais.
3. No backend, execute:
   ```powershell
   npx prisma validate
   npx prisma migrate deploy
   npx prisma generate
   npm run start:dev
   ```
4. No frontend, execute `npm run dev`.
5. Entre na plataforma e acesse `Simulador CBS / IBS` no menu ou abra `/simulador`.

## Importante sobre os resultados
Esta é uma ferramenta gerencial de estimativa, não uma apuração fiscal definitiva. As alíquotas iniciais são premissas editáveis e precisam ser confirmadas conforme legislação, período, regime, operação e enquadramento. A fórmula de crédito é deliberadamente simplificada; não cobre todas as condições, vedações, regimes específicos, destino, transição ou demais regras de incidência. Não use os resultados isoladamente para emissão de documentos ou recolhimento de tributos.

Não foi executada suíte de testes, conforme solicitado. Preserve o banco existente; a migração cria uma tabela nova e não deve exigir reset.
