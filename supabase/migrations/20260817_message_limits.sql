-- ─────────────────────────────────────────────────────────────
-- Migration: Trava de Mensagens por Plano
-- Data: 2026-08-17
-- ─────────────────────────────────────────────────────────────

-- 1. Adiciona limite de mensagens ao plano (null = ilimitado)
ALTER TABLE app.planos
  ADD COLUMN IF NOT EXISTS max_messages INTEGER DEFAULT NULL;

-- 2. Tabela de uso mensal por tenant
CREATE TABLE IF NOT EXISTS app.uso_mensal (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id       TEXT        NOT NULL,
  ano_mes         TEXT        NOT NULL,  -- 'YYYY-MM'
  total_mensagens INTEGER     NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uso_mensal_tenant_mes_unique UNIQUE (tenant_id, ano_mes)
);

-- Índice para busca por tenant (já coberto pela UNIQUE, mas explícito para clareza)
CREATE INDEX IF NOT EXISTS idx_uso_mensal_tenant_id ON app.uso_mensal (tenant_id);

-- 3. Comentários
COMMENT ON COLUMN app.planos.max_messages IS 'Limite de mensagens inbound por mês. NULL = ilimitado.';
COMMENT ON TABLE  app.uso_mensal          IS 'Contador mensal de mensagens por tenant (inbound, via webhook Evolution API).';
COMMENT ON COLUMN app.uso_mensal.ano_mes  IS 'Período no formato YYYY-MM (ex: 2026-08).';
