// ─────────────────────────────────────────────────────────────
// lib/evolution/message-limiter.ts
//
// Verifica se o tenant atingiu o limite mensal de mensagens
// definido no plano e incrementa o contador atomicamente.
//
// Tabela: app.uso_mensal (tenant_id, ano_mes, total_mensagens)
// ─────────────────────────────────────────────────────────────

import { queryOne, execute } from '@/lib/supabase/client'

export interface LimitCheck {
  blocked:   boolean       // true = limite atingido antes do incremento
  current:   number        // contagem após este incremento (ou atual se bloqueado)
  limit:     number | null // null = ilimitado
  nearLimit: boolean       // true se >= 90% do limite
}

function currentAnoMes(): string {
  return new Date().toISOString().slice(0, 7)  // 'YYYY-MM'
}

/**
 * Verifica o limite do plano para o tenant e incrementa o contador.
 * Se o limite já foi atingido, retorna { blocked: true } sem incrementar.
 * Se não há limite (max_messages IS NULL), incrementa e retorna { blocked: false }.
 */
export async function checkAndIncrement(tenantId: string): Promise<LimitCheck> {
  const anoMes = currentAnoMes()

  const [limitRow, usageRow] = await Promise.all([
    queryOne<{ max_messages: number | null }>(`
      SELECT p.max_messages
      FROM app.empresas e
      JOIN app.planos p ON p.id = e.plan_id
      WHERE e.id = $1
    `, [tenantId]),
    queryOne<{ total_mensagens: number }>(`
      SELECT total_mensagens
      FROM app.uso_mensal
      WHERE tenant_id = $1 AND ano_mes = $2
    `, [tenantId, anoMes]),
  ])

  const limit   = limitRow?.max_messages ?? null
  const current = Number(usageRow?.total_mensagens ?? 0)

  if (limit !== null && current >= limit) {
    return { blocked: true, current, limit, nearLimit: false }
  }

  // Upsert atômico — incrementa sem race condition
  await execute(`
    INSERT INTO app.uso_mensal (tenant_id, ano_mes, total_mensagens, updated_at)
    VALUES ($1, $2, 1, NOW())
    ON CONFLICT (tenant_id, ano_mes)
    DO UPDATE SET
      total_mensagens = app.uso_mensal.total_mensagens + 1,
      updated_at      = NOW()
  `, [tenantId, anoMes])

  const newCount  = current + 1
  const nearLimit = limit !== null && newCount >= Math.floor(limit * 0.9)

  return { blocked: false, current: newCount, limit, nearLimit }
}

/**
 * Retorna o uso atual do tenant no mês corrente sem incrementar.
 */
export async function getUsage(tenantId: string): Promise<{ current: number; limit: number | null; anoMes: string }> {
  const anoMes = currentAnoMes()

  const [limitRow, usageRow] = await Promise.all([
    queryOne<{ max_messages: number | null }>(`
      SELECT p.max_messages
      FROM app.empresas e
      JOIN app.planos p ON p.id = e.plan_id
      WHERE e.id = $1
    `, [tenantId]),
    queryOne<{ total_mensagens: number }>(`
      SELECT total_mensagens
      FROM app.uso_mensal
      WHERE tenant_id = $1 AND ano_mes = $2
    `, [tenantId, anoMes]),
  ])

  return {
    current: Number(usageRow?.total_mensagens ?? 0),
    limit:   limitRow?.max_messages ?? null,
    anoMes,
  }
}
