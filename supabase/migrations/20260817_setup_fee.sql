-- Migration: Taxa de Setup por Plano
-- Adiciona setup_fee_pct (% do valor mensal cobrada na implementação)

ALTER TABLE app.planos
  ADD COLUMN IF NOT EXISTS setup_fee_pct INTEGER NOT NULL DEFAULT 100;

COMMENT ON COLUMN app.planos.setup_fee_pct
  IS 'Taxa de setup em % do valor mensal (ex: 100 = 100% do plano, 50 = metade). Cobrada uma única vez na implementação.';
