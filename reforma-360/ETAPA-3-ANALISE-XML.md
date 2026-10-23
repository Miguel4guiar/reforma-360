# Reforma 360 — Etapa 3: Análise de XML

## O que foi acrescentado
- Tela `/xml` redesenhada, responsiva, com indicadores, busca, filtros, detalhes e área de arrastar/soltar arquivos.
- Importação de múltiplos arquivos XML e TXT (até 5 MB por arquivo). XML de NF-e modelo 55 tem extração estrutural; TXT fica anexado como material de apoio e marcado para revisão manual.
- API autenticada `GET /api/fiscal-documents?organizationId=...` e `POST /api/fiscal-documents/import`.
- Extração inicial de chave de acesso, número/série, emitente, destinatário, data, total e itens (descrição, NCM, CFOP, quantidade e valores).
- Sinalização de pontos para revisar e bloqueio de duplicidade por organização/chave de acesso.
- Tabela `FiscalDocument` vinculada à organização; a exclusão de uma organização remove seus documentos pela relação em cascata.
- A tela Análise de XML fica disponível no menu do painel.

## Instalação
1. Faça uma cópia de segurança do projeto e do banco antes de aplicar migrações.
2. Extraia o ZIP. Preserve seu arquivo `.env` local; ele não é incluído no pacote.
3. No backend, instale a dependência nova e atualize o cliente Prisma:
   ```powershell
   cd backend
   npm install
   npx prisma validate
   npx prisma generate
   npx prisma migrate deploy
   npm run start:dev
   ```
4. Em outro terminal, inicie o frontend:
   ```powershell
   cd frontend
   npm install
   npm run dev
   ```
5. Entre no sistema, selecione uma organização e acesse **Análise de XML**.

## Observações
- A migração `20261020190000_add_fiscal_documents` adiciona somente a nova tabela e índices; não redefine nem limpa tabelas existentes.
- O conteúdo original de XML ou TXT é armazenado para rastreabilidade e ocupa espaço no banco. O endpoint limita cada arquivo a 5 MB; o backend aceita corpo JSON de até 6 MB para a transferência.
- Nesta primeira versão, a leitura de XML é uma extração estrutural inicial; arquivos TXT são guardados como apoio e precisam de revisão manual. e não substitui validação fiscal oficial. A extração espera NF-e modelo 55 e os formatos XML comuns de NF-e processada ou não processada.
- As advertências exibidas não são cálculo fiscal nem determinação definitiva de CBS/IBS.
- Não foram executados testes automatizados nesta atualização, conforme solicitado.
