// ─────────────────────────────────────────────────────────────
// lib/evolution/message-limiter.ts
//
// Verifica e incrementa o contador mensal de mensagens por tenant.
// Dispara alerta (SSE + WhatsApp + e-mail) na primeira vez que
// o uso atingir >= 90% do limite definido no plano.
//
// Tabela: app.uso_mensal (tenant_id, ano_mes, total_mensagens, alerta_enviado)
// ─────────────────────────────────────────────────────────────

import { queryOne, execute, query } from '@/lib/supabase/client'

export interface LimitCheck {
  blocked:   boolean       // true = limite já atingido antes do incremento
  current:   number        // contagem após este incremento (ou atual se bloqueado)
  limit:     number | null // null = ilimitado
  nearLimit: boolean       // true se >= 90% (alert foi disparado)
}

function currentAnoMes(): string {
  return new Date().toISOString().slice(0, 7)  // 'YYYY-MM'
}

/**
 * Verifica o limite do plano e incrementa o contador.
 * Se o limite já foi atingido, retorna { blocked: true } sem incrementar.
 * Se >= 90% e o alerta ainda não foi enviado este mês, dispara sendLimitAlert().
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
    queryOne<{ total_mensagens: number; alerta_enviado: boolean }>(`
      SELECT total_mensagens, alerta_enviado
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
    INSERT INTO app.uso_mensal (tenant_id, ano_mes, total_mensagens, alerta_enviado, updated_at)
    VALUES ($1, $2, 1, FALSE, NOW())
    ON CONFLICT (tenant_id, ano_mes)
    DO UPDATE SET
      total_mensagens = app.uso_mensal.total_mensagens + 1,
      updated_at      = NOW()
  `, [tenantId, anoMes])

  const newCount  = current + 1
  const nearLimit = limit !== null && newCount >= Math.floor(limit * 0.9)

  // Dispara alerta apenas na primeira vez que >=90% (CAS — Compare And Set)
  if (nearLimit && !usageRow?.alerta_enviado) {
    const updated = await query<{ id: number }>(`
      UPDATE app.uso_mensal
      SET alerta_enviado = TRUE
      WHERE tenant_id = $1 AND ano_mes = $2 AND NOT alerta_enviado
      RETURNING id
    `, [tenantId, anoMes])

    if (updated.length > 0) {
      // Fire-and-forget — falha no alerta não bloqueia o processamento
      import('./limit-alert').then(m =>
        m.sendLimitAlert(tenantId, newCount, limit!).catch(err =>
          console.error('[Limiter] Erro ao enviar alerta de limite:', err)
        )
      ).catch(() => {})
    }
  }

  return { blocked: false, current: newCount, limit, nearLimit }
}

/**
 * Retorna o uso atual do tenant no mês corrente sem incrementar.
 */
export async function getUsage(tenantId: string): Promise<{
  current:  number
  limit:    number | null
  anoMes:   string
  pct:      number
}> {
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

  const current = Number(usageRow?.total_mensagens ?? 0)
  const limit   = limitRow?.max_messages ?? null
  const pct     = limit !== null && limit > 0 ? Math.round((current / limit) * 100) : 0

  return { current, limit, anoMes, pct }
}
