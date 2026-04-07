# Agência de Atendimento Digital — Back-end Next.js

SaaS Multi-Tenant para orquestrar Handoff IA ↔ Humano no WhatsApp.

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 14 (App Router) |
| Auth | NextAuth.js v4 — CredentialsProvider + JWT |
| Hash de senha | bcryptjs |
| Banco de dados | Google Sheets API v4 (googleapis) |
| Validação | Zod |
| Estilização | Tailwind CSS |
| Runtime | Node.js 18+ |

## Estrutura de arquivos

```
aad/
├── app/
│   ├── (auth)/
│   │   ├── login/          # Página de login
│   │   └── cadastro/       # Funil de leads + planos
│   ├── (app)/
│   │   ├── layout.tsx      # Sidebar + topbar + Kill Switch
│   │   └── workspace/      # Chat handoff IA ↔ Humano
│   ├── api/
│   │   ├── auth/[...nextauth]/  # NextAuth handler
│   │   ├── handoff/             # POST pausar/retomar/kill_switch
│   │   ├── plans/               # GET público + POST master
│   │   ├── leads/               # POST público + GET master
│   │   ├── tenants/             # CRUD master
│   │   ├── team/                # CRUD supervisor + toggles
│   │   └── blacklist/           # GET/POST autenticado
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx            # Redireciona para /workspace
├── lib/
│   ├── auth.ts             # NextAuthOptions + augmentações de tipo
│   ├── hooks/
│   │   └── use-handoff.ts  # Hook client-side para handoff
│   ├── repositories/
│   │   ├── users.repository.ts
│   │   ├── handoff.repository.ts
│   │   ├── blacklist.repository.ts
│   │   └── plans-tenants-leads.repository.ts
│   └── sheets/
│       └── client.ts       # Singleton Google Sheets API + helpers
├── middleware.ts            # RBAC — protege rotas por role
├── types/index.ts           # Tipos de domínio
└── components/
    └── session-provider.tsx
```

## Configuração Google Sheets

### Estrutura da planilha MASTER

| Aba | Colunas |
|---|---|
| `Usuarios` | id, tenantId, email, passwordHash, name, role, phone, canViewDashboard, canViewCRM, canViewTranscricoes, canViewSatisfacao, createdAt, isActive |
| `Empresas` | id, name, email, phone, planId, status, createdAt, evolutionInstance |
| `Planos` | id, name, price, period, maxInstances, maxAttendants, features, isActive |
| `Leads` | id, name, email, phone, company, planId, planName, status, createdAt |

### Estrutura da planilha de cada TENANT

| Aba | Colunas |
|---|---|
| `Fila_Humana` | Telefone, Status, Timestamp, Atendente |
| `Usuarios` | id, tenantId, email, passwordHash, name, role, phone, (toggles...) |
| `Clientes` | telefone, nome, status, historico |
| `Atendimentos` | id, telefone, nome, inicio, fim, duracao, atendente, satisfacao |
| `Satisfacao` | timestamp, telefone, nota, atendimentoId, atendente |
| `Blacklist` | telefone, motivo, atendente, timestamp |
| `Conhecimento` | pergunta, resposta, categoria, data |
| `Log_Erros` | timestamp, no, erro, telefone |

## Setup

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.local.example .env.local
# Edite .env.local com suas credenciais

# 3. Criar Service Account no Google Cloud Console
# - Habilitar Google Sheets API
# - Criar Service Account
# - Gerar chave JSON
# - Compartilhar a planilha Master com o e-mail do Service Account (Editor)

# 4. Rodar em desenvolvimento
npm run dev
```

## Regra de Handoff (EXTREMA IMPORTÂNCIA)

`POST /api/handoff` grava na aba `Fila_Humana` do tenant com exatamente 4 colunas:

```
A: Telefone  →  número do cliente OU "ALL" (kill switch)
B: Status    →  "pausado" ou "ativo"
C: Timestamp →  ISO 8601
D: Atendente →  ID do usuário logado
```

O n8n faz polling nessa aba para detectar pausas e retomadas.

## RBAC

| Role | Acesso |
|---|---|
| `master` | Tudo — gestão de empresas, planos, blacklist global, logs |
| `supervisor` | Sua operação — conexão WhatsApp, equipe, planos, workspace |
| `atendente` | Workspace + telas liberadas pelo supervisor via toggles |

## Criar usuário Master Admin

```typescript
// Script one-off para criar o primeiro usuário master:
import bcrypt from 'bcryptjs'
import { UsersRepository } from './lib/repositories/users.repository'

const repo = new UsersRepository(process.env.GOOGLE_MASTER_SHEET_ID)
await repo.create({
  id:                  crypto.randomUUID(),
  tenantId:            process.env.GOOGLE_MASTER_SHEET_ID!,
  email:               'admin@aad.com.br',
  passwordHash:        await bcrypt.hash('sua-senha-segura', 12),
  name:                'Master Admin',
  role:                'master',
  canViewDashboard:    true,
  canViewCRM:          true,
  canViewTranscricoes: true,
  canViewSatisfacao:   true,
  createdAt:           new Date().toISOString(),
  isActive:            true,
})
```
