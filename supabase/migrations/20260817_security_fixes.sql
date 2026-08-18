-- ================================================================
-- ComAgente — Migration: Correções de segurança do Supabase Advisor
--
-- Fix 1: Habilita RLS na tabela public._comagente_notify
-- Fix 2: Fixa search_path na função public.create_tenant_schema
--
-- Execute no Supabase SQL Editor
-- ================================================================


-- ================================================================
-- FIX 1: Row Level Security em public._comagente_notify
-- Impede acesso via API REST (PostgREST) por roles anon/authenticated.
-- O service_role continua com acesso total pois bypassa RLS por padrão.
-- ================================================================

ALTER TABLE public._comagente_notify ENABLE ROW LEVEL SECURITY;


-- ================================================================
-- FIX 2: search_path fixo em public.create_tenant_schema
-- Evita ataques de search_path injection onde uma função ou schema
-- malicioso poderia interceptar chamadas internas.
-- SET search_path = '' força todas as referências a serem explícitas —
-- seguro pois o corpo da função já usa EXECUTE format('%I.tabela', schema_name).
-- ================================================================

CREATE OR REPLACE FUNCTION public.create_tenant_schema(schema_name TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);

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
      id             BIGSERIAL PRIMARY KEY,
      timestamp      TIMESTAMPTZ DEFAULT NOW(),
      telefone       TEXT DEFAULT '''',
      nota           NUMERIC(3,1) DEFAULT 0,
      atendimento_id TEXT DEFAULT '''',
      atendente      TEXT DEFAULT ''Bot''
    )', schema_name);

  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.fila_humana (
      id        BIGSERIAL PRIMARY KEY,
      telefone  TEXT NOT NULL,
      status    TEXT NOT NULL DEFAULT ''pausado'',
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      atendente TEXT DEFAULT ''''
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
      id        BIGSERIAL PRIMARY KEY,
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      no        TEXT DEFAULT '''',
      erro      TEXT DEFAULT '''',
      telefone  TEXT DEFAULT ''''
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
      id        BIGSERIAL PRIMARY KEY,
      timestamp TIMESTAMPTZ DEFAULT NOW(),
      telefone  TEXT DEFAULT '''',
      atendente TEXT DEFAULT '''',
      acao      TEXT DEFAULT ''''
    )', schema_name);

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
$$ LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = '';
