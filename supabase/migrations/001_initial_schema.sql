-- ═══════════════════════════════════════════════════════════════
-- ComAgente — Migration 001: Schema inicial
-- Schemas: app (global), tenant_lucena, tenant_trackermap
-- ═══════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────
-- SCHEMA: app  (dados globais / Master Admin)
-- ────────────────────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS app;

-- Planos
CREATE TABLE IF NOT EXISTS app.planos (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  price        NUMERIC(10,2) DEFAULT 0,
  period       TEXT DEFAULT 'monthly',
  max_instances  INTEGER DEFAULT 1,
  max_attendants INTEGER DEFAULT 2,
  features     JSONB DEFAULT '[]',
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Empresas (Tenants)
CREATE TABLE IF NOT EXISTS app.empresas (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  email              TEXT NOT NULL,
  phone              TEXT DEFAULT '',
  plan_id            TEXT REFERENCES app.planos(id),
  status             TEXT DEFAULT 'trial' CHECK (status IN ('active', 'inactive', 'trial')),
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  evolution_instance TEXT DEFAULT '',
  spreadsheet_id     TEXT DEFAULT '',
  supabase_schema    TEXT DEFAULT ''
);

-- Usuários
CREATE TABLE IF NOT EXISTS app.usuarios (
  id                    TEXT PRIMARY KEY,
  tenant_id             TEXT NOT NULL REFERENCES app.empresas(id),
  email                 TEXT NOT NULL,
  password_hash         TEXT NOT NULL,
  name                  TEXT NOT NULL,
  role                  TEXT NOT NULL CHECK (role IN ('master', 'supervisor', 'atendente')),
  phone                 TEXT DEFAULT '',
  can_view_dashboard    BOOLEAN DEFAULT false,
  can_view_crm          BOOLEAN DEFAULT false,
  can_view_transcricoes BOOLEAN DEFAULT false,
  can_view_satisfacao   BOOLEAN DEFAULT false,
  can_view_agendamentos BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  is_active             BOOLEAN DEFAULT true,
  avatar_url            TEXT DEFAULT '',
  must_change_password  BOOLEAN DEFAULT false
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_email ON app.usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_tenant ON app.usuarios(tenant_id);

-- Leads
CREATE TABLE IF NOT EXISTS app.leads (
  id         TEXT PRIMARY KEY,
  name       TEXT DEFAULT '',
  email      TEXT DEFAULT '',
  phone      TEXT DEFAULT '',
  company    TEXT DEFAULT '',
  plan_id    TEXT DEFAULT '',
  plan_name  TEXT DEFAULT '',
  status     TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'converted', 'lost')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Blacklist Global (cross-tenant)
CREATE TABLE IF NOT EXISTS app.blacklist_global (
  id        BIGSERIAL PRIMARY KEY,
  telefone  TEXT NOT NULL,
  motivo    TEXT DEFAULT '',
  atendente TEXT DEFAULT '',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_blacklist_global_telefone ON app.blacklist_global(telefone);

-- Reset Tokens
CREATE TABLE IF NOT EXISTS app.reset_tokens (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES app.usuarios(id),
  email      TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ
);

-- ────────────────────────────────────────────────────────────────
-- Função helper: cria as tabelas de um tenant em um schema
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_tenant_schema(schema_name TEXT)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);

  -- Clientes (inclui campos CRM)
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.clientes (
      id                BIGSERIAL PRIMARY KEY,
      telefone          TEXT NOT NULL,
      nome              TEXT NOT NULL DEFAULT '''',
      status            TEXT DEFAULT '''',
      historico         TEXT DEFAULT '''',
      etapa             TEXT DEFAULT ''novo'',
      tags              TEXT DEFAULT '''',
      ultimo_contato    TIMESTAMPTZ,
      proximo_follow_up TIMESTAMPTZ,
      valor_estimado    TEXT DEFAULT '''',
      atendente         TEXT DEFAULT '''',
      notas             TEXT DEFAULT '''',
      origem            TEXT DEFAULT ''WhatsApp'',
      created_at        TIMESTAMPTZ DEFAULT NOW(),
      updated_at        TIMESTAMPTZ DEFAULT NOW()
    )', schema_name);

  EXECUTE format('
    CREATE UNIQUE INDEX IF NOT EXISTS clientes_telefone_idx
    ON %I.clientes(telefone)', schema_name);

  -- Atendimentos
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.atendimentos (
      id         TEXT PRIMARY KEY,
      telefone   TEXT DEFAULT '''',
      nome       TEXT DEFAULT '''',
      inicio     TIMESTAMPTZ,
      fim        TIMESTAMPTZ,
      duracao    TEXT DEFAULT '''',
      atendente  TEXT DEFAULT ''Bot'',
      satisfacao INTEGER
    )', schema_name);

  -- Satisfacao
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.satisfacao (
      id              BIGSERIAL PRIMARY KEY,
      timestamp       TIMESTAMPTZ DEFAULT NOW(),
      telefone        TEXT DEFAULT '''',
      nota            NUMERIC(3,1) DEFAULT 0,
      atendimento_id  TEXT DEFAULT '''',
      atendente       TEXT DEFAULT ''Bot''
    )', schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.fila_humana (
      id         BIGSERIAL PRIMARY KEY,
      telefone   TEXT NOT NULL,
      status     TEXT NOT NULL DEFAULT ''pausado'',
      timestamp  TIMESTAMPTZ DEFAULT NOW(),
      atendente  TEXT DEFAULT ''''
    )', schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.templates (
      id         TEXT PRIMARY KEY,
      atalho     TEXT NOT NULL,
      titulo     TEXT NOT NULL,
      mensagem   TEXT NOT NULL,
      categoria  TEXT DEFAULT ''geral'',
      criado_por TEXT DEFAULT '''',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      is_active  BOOLEAN DEFAULT true
    )', schema_name);

  EXECUTE format('
    CREATE UNIQUE INDEX IF NOT EXISTS templates_atalho_idx
    ON %I.templates(atalho)', schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.blacklist (
      id         BIGSERIAL PRIMARY KEY,
      telefone   TEXT NOT NULL,
      motivo     TEXT DEFAULT '''',
      atendente  TEXT DEFAULT '''',
      timestamp  TIMESTAMPTZ DEFAULT NOW()
    )', schema_name);

  EXECUTE format('
    CREATE UNIQUE INDEX IF NOT EXISTS blacklist_telefone_idx
    ON %I.blacklist(telefone)', schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.log_erros (
      id         BIGSERIAL PRIMARY KEY,
      timestamp  TIMESTAMPTZ DEFAULT NOW(),
      no         TEXT DEFAULT '''',
      erro       TEXT DEFAULT '''',
      telefone   TEXT DEFAULT ''''
    )', schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.agendamentos (
      id         BIGSERIAL PRIMARY KEY,
      data       JSONB NOT NULL DEFAULT ''{}'',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )', schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.distribuicao (
      id                 BIGSERIAL PRIMARY KEY,
      atendente_id       TEXT NOT NULL,
      atendente_nome     TEXT DEFAULT '''',
      atendente_phone    TEXT DEFAULT '''',
      online             BOOLEAN DEFAULT false,
      especialidade      TEXT DEFAULT ''geral'',
      max_conversas      INTEGER DEFAULT 5,
      conversas_ativas   INTEGER DEFAULT 0,
      ultima_atribuicao  TIMESTAMPTZ,
      total_atribuidos   INTEGER DEFAULT 0
    )', schema_name);

  EXECUTE format('
    CREATE UNIQUE INDEX IF NOT EXISTS distribuicao_atendente_idx
    ON %I.distribuicao(atendente_id)', schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.log_distribuicao (
      id               TEXT PRIMARY KEY,
      telefone_cliente TEXT DEFAULT '''',
      atendente_id     TEXT DEFAULT '''',
      atendente_nome   TEXT DEFAULT '''',
      timestamp        TIMESTAMPTZ DEFAULT NOW(),
      motivo           TEXT DEFAULT ''round-robin''
    )', schema_name);
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- SCHEMA: tenant_lucena
-- ────────────────────────────────────────────────────────────────
SELECT create_tenant_schema('tenant_lucena');

-- ────────────────────────────────────────────────────────────────
-- SCHEMA: tenant_trackermap
-- ────────────────────────────────────────────────────────────────
SELECT create_tenant_schema('tenant_trackermap');
