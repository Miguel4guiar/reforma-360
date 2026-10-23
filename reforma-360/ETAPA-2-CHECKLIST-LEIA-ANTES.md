# Reforma 360 — Etapa 2: Checklist de adequação

Este pacote é baseado no projeto `reforma-360.zip` enviado anteriormente. Os arquivos existentes foram preservados, o CSS foi complementado (não substituído) e o arquivo `.env` foi removido do pacote por segurança.

## O que foi adicionado
- API autenticada para listar, criar, atualizar status e excluir tarefas do checklist.
- Isolamento por organização: a API valida a associação do usuário à organização e valida que a empresa selecionada pertence à mesma organização.
- Campos: título, descrição, categoria, empresa opcional, status, prioridade, prazo, responsável e link de evidência.
- Tela responsiva `/checklist`, pesquisa, filtro por status, contadores e criação de tarefas.
- Migração SQL aditiva; não remove tabelas nem registros atuais.

## Antes de executar
1. Faça uma cópia de segurança do banco de dados e do projeto.
2. Não compartilhe o arquivo `backend/.env`. O `.env.example` pode ser usado como modelo.
3. Confirme que `backend/.env` local contém a `DATABASE_URL` correta.

## Aplicar a migração
No terminal, entre na pasta `backend`:
```powershell
npm install
npx prisma migrate deploy
npx prisma generate
npm run build
```

Se o ambiente estiver em desenvolvimento e a política do projeto usar `migrate dev`, revise a migration antes de executar. Não use `prisma migrate reset`: isso pode apagar dados.

Depois, na pasta `frontend`:
```powershell
npm install
npm run build
```

## Teste manual
1. Entre com uma conta existente.
2. Abra “Checklist de adequação” pelo menu do painel.
3. Crie uma tarefa sem empresa e outra vinculada a uma empresa da organização.
4. Altere o status entre Pendente, Em andamento e Concluída.
5. Atualize a página e confirme que as tarefas continuam salvas.
6. Entre com outra conta e confirme que ela não enxerga as tarefas da primeira organização.

## Observação
Este pacote foi conferido quanto à estrutura dos arquivos e integração com os nomes de rota, token e modelos presentes no ZIP fornecido. A compilação real precisa ser executada no seu ambiente, com as dependências e variáveis locais. O checklist é uma ferramenta de organização; não substitui a validação tributária por legislação vigente e especialista fiscal.


## Se aparecer `checklistItem` ou tipos Prisma não encontrados

Esses erros normalmente significam que o Prisma Client instalado ainda foi gerado antes de o modelo `ChecklistItem` ser adicionado ao schema. Na pasta `backend`, execute nesta ordem:

```powershell
npx prisma format
npx prisma validate
npx prisma generate
npm run build
```

Se `prisma validate` disser que faltam relações, não continue para produção: envie a mensagem completa para corrigirmos o schema. Em seguida, aplique a migration no banco com `npx prisma migrate deploy` (após backup). Não use `prisma migrate reset`.
