# Reforma 360 — v0.3.0 (autenticação e isolamento inicial)

Projeto SaaS em desenvolvimento: Next.js + TypeScript, NestJS, Prisma e PostgreSQL.

## Entregas desta versão
- Cadastro de usuário com e-mail e senha (hash bcrypt, custo 12).
- Criação da primeira organização durante o cadastro.
- Login com token JWT de 8 horas.
- Logout no frontend.
- Rotas de organizações e empresas protegidas por Bearer token.
- Backend valida a associação do usuário à organização antes de listar/criar empresas.
- Organizações listadas apenas para o usuário autenticado.
- Preservação dos registros existentes no banco. No cadastro do primeiro usuário, organizações antigas sem nenhum membro são associadas a esse usuário para permitir continuidade dos dados locais.

## Avisos antes de produção
Esta versão é uma etapa de desenvolvimento e ainda não deve ser exposta a usuários reais. Antes de produção, configure um JWT_SECRET forte e privado, HTTPS, limitação de tentativas de login, recuperação de senha, política de sessão, testes de segurança e revisão de permissões. Não use dados fiscais reais ainda. Não publique o segredo no Git.

## Requisitos
- Node.js 22 LTS
- PostgreSQL
- `DATABASE_URL` configurada em `backend/.env`
- `JWT_SECRET` forte em `backend/.env` (mínimo recomendado 32 caracteres aleatórios)

## Instalação/atualização
Faça backup da pasta atual antes de substituir arquivos. Mantenha o `.env` existente e não o sobrescreva.

### Backend
```powershell
cd backend
npm install
npx prisma generate
npm run build
npm run start:dev
```

O schema Prisma desta versão reutiliza os modelos User e Membership já existentes no schema da versão 0.2.0, portanto não é necessária uma nova migração se o banco foi criado com aquela versão. Se o banco foi criado a partir de outro schema, compare antes de aplicar qualquer migração.

### Frontend (outro terminal)
```powershell
cd frontend
npm install
npm run build
npm run dev
```

Acesse `http://localhost:3000`. A API fica em `http://localhost:3001/api`; Swagger em `http://localhost:3001/api/docs`.

## Fluxo de teste
1. Abra o site e crie uma conta com e-mail válido e senha de pelo menos 10 caracteres contendo letras e números.
2. Cadastre o nome e o tipo da organização inicial.
3. Confirme que o dashboard lista a organização e as empresas associadas.
4. Cadastre uma empresa e atualize a página para verificar persistência.
5. Clique em sair, entre novamente com o mesmo e-mail e senha e confirme que os dados continuam acessíveis.
6. Tente listar empresas sem token usando Swagger ou `curl`: deve responder `401`.
7. Tente usar o token de um usuário A com o `organizationId` de uma organização do usuário B: deve responder `403`.
8. Registre outro usuário e confirme que ele não vê organizações já vinculadas ao usuário A.

## Endpoints
- `GET /api/health` — público
- `POST /api/auth/register` — cadastro de usuário e organização inicial
- `POST /api/auth/login` — login
- `GET /api/auth/me` — usuário autenticado e organizações
- `GET /api/organizations` — organizações do usuário autenticado
- `POST /api/organizations` — cria organização e vincula usuário como OWNER
- `GET /api/companies?organizationId=...` — lista empresas se o usuário for membro
- `POST /api/companies` — cria empresa somente em organização vinculada

## Próximos módulos
1. Testes de segurança, gestão de membros e convites para equipe.
2. Checklist de adequação tributária.
3. Importação e validação técnica de XML.
4. Motor versionado de cálculos CBS/IBS, créditos, custos, preços, margens e fluxo de caixa com memória de cálculo e testes automatizados.
5. Relatórios e auditoria.


## Etapa 4 — Simulador CBS / IBS

Consulte `ETAPA-4-SIMULADOR-CBS-IBS.md` para instruções de instalação, escopo e limitações da simulação. A tela fica disponível em `/simulador` e os cenários são armazenados por organização.
