-- ================================================================
-- ComAgente — Migration: tabela de nonces para upload de conhecimento
-- Garante que o schema do tenant nunca trafegue pelo N8N.
-- O N8N recebe apenas um token de uso único com validade de 10 min.
-- Execute no Supabase SQL Editor
-- ================================================================

CREATE TABLE IF NOT EXISTS app.knowledge_nonces (
  token      TEXT PRIMARY KEY,
  schema     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '10 minutes'
);

CREATE INDEX IF NOT EXISTS idx_knowledge_nonces_expires
  ON app.knowledge_nonces (expires_at);

COMMENT ON TABLE app.knowledge_nonces IS
  'Tokens de uso único para associar uploads de documentos ao tenant correto sem expor o schema ao N8N.';
