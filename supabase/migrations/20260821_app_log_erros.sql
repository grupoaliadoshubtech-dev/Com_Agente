-- Migration: app.log_erros
-- Log global de erros do webhook (substitui Google Sheets Log_Erros!A:D do Master)

CREATE TABLE IF NOT EXISTS app.log_erros (
  id        BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  no        TEXT DEFAULT '',   -- endpoint / evento
  erro      TEXT DEFAULT '',   -- mensagem do erro
  instancia TEXT DEFAULT ''    -- nome da instância Evolution
);

CREATE INDEX IF NOT EXISTS idx_log_erros_timestamp ON app.log_erros(timestamp DESC);
