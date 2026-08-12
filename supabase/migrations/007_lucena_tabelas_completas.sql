-- ================================================================
-- ComAgente — Migration 007: Lucena Decorações — Todas as Tabelas
-- 11 abas da planilha → tabelas Supabase (cria se não existir)
-- Execute no Supabase SQL Editor
-- ================================================================


-- ══════════════════════════════════════════════════════════════════
-- TABELAS JÁ EXISTENTES (criadas pela função create_tenant_schema)
-- Listadas aqui para referência e garantia de integridade
-- ══════════════════════════════════════════════════════════════════

-- Aba: Clientes → tenant_lucena.clientes (já existe + 3 registros)
-- Aba: Atendimentos (sessões) → tenant_lucena.atendimentos (já existe, vazia)
-- Aba: Satisfacao → tenant_lucena.satisfacao (já existe + 57 registros)
-- Aba: Fila_Humana → tenant_lucena.fila_humana (já existe, vazia)
-- Aba: Blacklist → tenant_lucena.blacklist (já existe, vazia)
-- Aba: Log_Erros → tenant_lucena.log_erros (já existe + 118 na migration 006)
-- Aba: Agendamentos → tenant_lucena.agendamentos (já existe + 3 na migration 006)


-- ══════════════════════════════════════════════════════════════════
-- 1. tenant_lucena.instancia — aba "Instância"
-- Guarda o nome/configuração da instância do tenant
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tenant_lucena.instancia (
  id         BIGSERIAL PRIMARY KEY,
  empresa    TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO tenant_lucena.instancia (empresa)
VALUES ('Lucena Decorações')
ON CONFLICT DO NOTHING;


-- ══════════════════════════════════════════════════════════════════
-- 2. tenant_lucena.primeiros_contatos — aba "Primeiros_Contatos"
-- Leads/contatos iniciais aguardando retorno
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tenant_lucena.primeiros_contatos (
  id         BIGSERIAL PRIMARY KEY,
  telefone   TEXT NOT NULL DEFAULT '',
  parceiro   TEXT DEFAULT '',
  data       TIMESTAMPTZ DEFAULT NOW(),
  status     TEXT DEFAULT 'aguardando',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO tenant_lucena.primeiros_contatos (telefone, parceiro, data, status)
SELECT '5571981153749', 'Rogério', TO_TIMESTAMP('03/08/2026 17:44:06','DD/MM/YYYY HH24:MI:SS'), 'aguardando'
WHERE NOT EXISTS (SELECT 1 FROM tenant_lucena.primeiros_contatos WHERE telefone = '5571981153749');

INSERT INTO tenant_lucena.primeiros_contatos (telefone, parceiro, data, status)
SELECT '557181153749', 'Rogério', TO_TIMESTAMP('05/08/2026 14:30:44','DD/MM/YYYY HH24:MI:SS'), 'aguardando'
WHERE NOT EXISTS (SELECT 1 FROM tenant_lucena.primeiros_contatos WHERE telefone = '557181153749');


-- ══════════════════════════════════════════════════════════════════
-- 3. tenant_lucena.conhecimento — aba "Conhecimento"
-- Base de conhecimento (FAQ) da IA — vazia, alimentada pelo sistema
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tenant_lucena.conhecimento (
  id         BIGSERIAL PRIMARY KEY,
  pergunta   TEXT NOT NULL DEFAULT '',
  resposta   TEXT NOT NULL DEFAULT '',
  categoria  TEXT DEFAULT 'geral',
  data       TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active  BOOLEAN DEFAULT true,
  UNIQUE(pergunta)
);


-- ══════════════════════════════════════════════════════════════════
-- 4. tenant_lucena.transcricoes — criada na migration 006
-- Aba "Atendimentos" (logs de mensagens) → tabela separada de atendimentos
-- Garantia: recria se migration 006 ainda não foi executada
-- ══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tenant_lucena.transcricoes (
  id          BIGSERIAL PRIMARY KEY,
  timestamp   TIMESTAMPTZ DEFAULT NOW(),
  telefone    TEXT DEFAULT '',
  nome        TEXT DEFAULT '',
  intencao    TEXT DEFAULT '',
  sentimento  TEXT DEFAULT '',
  transcricao TEXT DEFAULT '',
  preview     TEXT DEFAULT ''
);


-- ══════════════════════════════════════════════════════════════════
-- 5. app.usuarios — aba "Usuarios"
-- 4 usuários da Lucena: verificar se já existem antes de inserir
-- NOTA: passwordHash não disponível via planilha — usar ON CONFLICT DO NOTHING
-- ══════════════════════════════════════════════════════════════════

-- Buscar tenant_id real da Lucena em app.empresas
DO $$
DECLARE
  v_tenant_id TEXT;
BEGIN
  SELECT id INTO v_tenant_id FROM app.empresas WHERE supabase_schema = 'tenant_lucena' LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE NOTICE 'tenant_lucena não encontrado em app.empresas — usuarios não inseridos';
    RETURN;
  END IF;

  -- Maicom
  INSERT INTO app.usuarios (id, tenant_id, email, password_hash, name, role, phone,
    can_view_dashboard, can_view_crm, can_view_transcricoes, can_view_satisfacao,
    can_view_agendamentos, created_at, is_active)
  SELECT '84ee4df8-bb14-4019-ae09-a92f4a39f27b', v_tenant_id,
    'canecassa@gmail.com', '', 'Maicom', 'supervisor', '71981914361',
    true, true, true, true, true, '2026-04-11T02:42:14.750Z', true
  WHERE NOT EXISTS (SELECT 1 FROM app.usuarios WHERE id = '84ee4df8-bb14-4019-ae09-a92f4a39f27b' OR email = 'canecassa@gmail.com');

  -- Lucena
  INSERT INTO app.usuarios (id, tenant_id, email, password_hash, name, role, phone,
    can_view_dashboard, can_view_crm, can_view_transcricoes, can_view_satisfacao,
    can_view_agendamentos, created_at, is_active)
  SELECT 'be261c54-98f1-40b4-bfd1-459b259ad2b7', v_tenant_id,
    'lucena@gmail.com', '', 'Lucena', 'supervisor', '71981914361',
    true, true, true, true, true, '2026-04-11T02:57:02.346Z', true
  WHERE NOT EXISTS (SELECT 1 FROM app.usuarios WHERE id = 'be261c54-98f1-40b4-bfd1-459b259ad2b7' OR email = 'lucena@gmail.com');

  -- Lucena Decorações (mesmo email que Lucena — só insere se nenhum dos dois já existe)
  INSERT INTO app.usuarios (id, tenant_id, email, password_hash, name, role, phone,
    can_view_dashboard, can_view_crm, can_view_transcricoes, can_view_satisfacao,
    can_view_agendamentos, created_at, is_active)
  SELECT 'dddb49d8-d07c-4c98-a441-8b724e63d8c8', v_tenant_id,
    'lucena+decoracoes@gmail.com', '', 'Lucena Decorações', 'supervisor', '7181914361',
    true, true, true, true, true, '2026-04-11T03:03:30.944Z', true
  WHERE NOT EXISTS (SELECT 1 FROM app.usuarios WHERE id = 'dddb49d8-d07c-4c98-a441-8b724e63d8c8');

  -- Radija Lucena
  INSERT INTO app.usuarios (id, tenant_id, email, password_hash, name, role, phone,
    can_view_dashboard, can_view_crm, can_view_transcricoes, can_view_satisfacao,
    can_view_agendamentos, created_at, is_active)
  SELECT '40c51ffe-c546-4f58-a3fa-e1e19b17547d', v_tenant_id,
    'radijalucena1@hotmail.com', '', 'Radija lucena', 'supervisor', '71999068502',
    true, true, true, true, true, '2026-06-20T02:04:19.984Z', true
  WHERE NOT EXISTS (SELECT 1 FROM app.usuarios WHERE id = '40c51ffe-c546-4f58-a3fa-e1e19b17547d' OR email = 'radijalucena1@hotmail.com');

  RAISE NOTICE 'Usuarios da Lucena processados com tenant_id = %', v_tenant_id;
END $$;


-- ══════════════════════════════════════════════════════════════════
-- 6. Atualiza create_tenant_schema() para incluir as novas tabelas
-- Garante que novos tenants também recebam instancia, primeiros_contatos e conhecimento
-- ══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.create_tenant_schema(schema_name TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);

  -- Tabelas originais
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.clientes (
      telefone          TEXT PRIMARY KEY,
      nome              TEXT DEFAULT '''',
      status            TEXT DEFAULT ''ativo'',
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
    CREATE TABLE IF NOT EXISTS %I.atendimentos (
      id         BIGSERIAL PRIMARY KEY,
      telefone   TEXT DEFAULT '''',
      nome       TEXT DEFAULT '''',
      inicio     TIMESTAMPTZ DEFAULT NOW(),
      fim        TIMESTAMPTZ,
      duracao    TEXT DEFAULT '''',
      atendente  TEXT DEFAULT ''Bot'',
      satisfacao INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )', schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.satisfacao (
      id              BIGSERIAL PRIMARY KEY,
      timestamp       TIMESTAMPTZ DEFAULT NOW(),
      telefone        TEXT DEFAULT '''',
      nota            NUMERIC DEFAULT 0,
      atendimento_id  TEXT DEFAULT '''',
      atendente       TEXT DEFAULT ''Bot''
    )', schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.fila_humana (
      id         BIGSERIAL PRIMARY KEY,
      telefone   TEXT NOT NULL,
      nome       TEXT DEFAULT '''',
      motivo     TEXT DEFAULT '''',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )', schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.templates (
      id         BIGSERIAL PRIMARY KEY,
      nome       TEXT NOT NULL,
      conteudo   TEXT DEFAULT '''',
      categoria  TEXT DEFAULT ''geral'',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )', schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.blacklist (
      telefone   TEXT PRIMARY KEY,
      motivo     TEXT DEFAULT '''',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )', schema_name);

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
      data       JSONB DEFAULT ''{}'',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )', schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.distribuicao (
      id         BIGSERIAL PRIMARY KEY,
      telefone   TEXT DEFAULT '''',
      atendente  TEXT DEFAULT '''',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )', schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.log_distribuicao (
      id         BIGSERIAL PRIMARY KEY,
      timestamp  TIMESTAMPTZ DEFAULT NOW(),
      telefone   TEXT DEFAULT '''',
      atendente  TEXT DEFAULT '''',
      acao       TEXT DEFAULT ''''
    )', schema_name);

  -- Tabelas novas (adicionadas na migration 007)
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.transcricoes (
      id          BIGSERIAL PRIMARY KEY,
      timestamp   TIMESTAMPTZ DEFAULT NOW(),
      telefone    TEXT DEFAULT '''',
      nome        TEXT DEFAULT '''',
      intencao    TEXT DEFAULT '''',
      sentimento  TEXT DEFAULT '''',
      transcricao TEXT DEFAULT '''',
      preview     TEXT DEFAULT ''''
    )', schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.instancia (
      id         BIGSERIAL PRIMARY KEY,
      empresa    TEXT NOT NULL DEFAULT '''',
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )', schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.primeiros_contatos (
      id         BIGSERIAL PRIMARY KEY,
      telefone   TEXT NOT NULL DEFAULT '''',
      parceiro   TEXT DEFAULT '''',
      data       TIMESTAMPTZ DEFAULT NOW(),
      status     TEXT DEFAULT ''aguardando'',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )', schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.conhecimento (
      id         BIGSERIAL PRIMARY KEY,
      pergunta   TEXT NOT NULL DEFAULT '''',
      resposta   TEXT NOT NULL DEFAULT '''',
      categoria  TEXT DEFAULT ''geral'',
      data       TIMESTAMPTZ DEFAULT NOW(),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      is_active  BOOLEAN DEFAULT true,
      UNIQUE(pergunta)
    )', schema_name);

END;
$$ LANGUAGE plpgsql;


-- ══════════════════════════════════════════════════════════════════
-- Verificação Final — todas as 11 abas mapeadas
-- ══════════════════════════════════════════════════════════════════
SELECT 'tenant_lucena.instancia'          AS tabela, COUNT(*) AS total FROM tenant_lucena.instancia          UNION ALL
SELECT 'tenant_lucena.primeiros_contatos' AS tabela, COUNT(*) AS total FROM tenant_lucena.primeiros_contatos UNION ALL
SELECT 'tenant_lucena.conhecimento'       AS tabela, COUNT(*) AS total FROM tenant_lucena.conhecimento       UNION ALL
SELECT 'tenant_lucena.transcricoes'       AS tabela, COUNT(*) AS total FROM tenant_lucena.transcricoes       UNION ALL
SELECT 'tenant_lucena.clientes'           AS tabela, COUNT(*) AS total FROM tenant_lucena.clientes           UNION ALL
SELECT 'tenant_lucena.atendimentos'       AS tabela, COUNT(*) AS total FROM tenant_lucena.atendimentos       UNION ALL
SELECT 'tenant_lucena.satisfacao'         AS tabela, COUNT(*) AS total FROM tenant_lucena.satisfacao         UNION ALL
SELECT 'tenant_lucena.fila_humana'        AS tabela, COUNT(*) AS total FROM tenant_lucena.fila_humana        UNION ALL
SELECT 'tenant_lucena.blacklist'          AS tabela, COUNT(*) AS total FROM tenant_lucena.blacklist          UNION ALL
SELECT 'tenant_lucena.log_erros'          AS tabela, COUNT(*) AS total FROM tenant_lucena.log_erros          UNION ALL
SELECT 'tenant_lucena.agendamentos'       AS tabela, COUNT(*) AS total FROM tenant_lucena.agendamentos       UNION ALL
SELECT 'app.usuarios (lucena)'            AS tabela, COUNT(*) AS total
  FROM app.usuarios u
  JOIN app.empresas e ON u.tenant_id = e.id
  WHERE e.supabase_schema = 'tenant_lucena';
