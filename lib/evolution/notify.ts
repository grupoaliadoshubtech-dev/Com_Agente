// lib/evolution/notify.ts
// Tabela leve no Neon usada para sinalizar novas mensagens ao frontend via SSE.
// O webhook escreve aqui; o endpoint /api/evolution/stream faz long-poll.
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.EVOLUTION_DB_URL })

let tableReady = false

async function ensureTable(): Promise<void> {
  if (tableReady) return
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _comagente_notify (
      id         BIGSERIAL PRIMARY KEY,
      instance   TEXT NOT NULL,
      phone      TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  await pool.query(`
    CREATE INDEX IF NOT EXISTS _coma_notify_idx
    ON _comagente_notify (instance, id DESC)
  `)
  tableReady = true
}

export async function pushNotification(instance: string, phone: string | null): Promise<void> {
  try {
    await ensureTable()
    await pool.query(
      'INSERT INTO _comagente_notify (instance, phone) VALUES ($1, $2)',
      [instance, phone] as unknown[]
    )
    // Mantém a tabela pequena — descarta entradas com mais de 60 s
    pool.query(
      `DELETE FROM _comagente_notify WHERE created_at < now() - interval '60 seconds'`
    ).catch(() => {})
  } catch {
    // Não crítico — falha silenciosa
  }
}

export async function getLatestNotifyId(instance: string): Promise<number> {
  try {
    await ensureTable()
    const { rows } = await pool.query<{ max_id: number }>(
      'SELECT COALESCE(MAX(id), 0) AS max_id FROM _comagente_notify WHERE instance = $1',
      [instance]
    )
    return Number(rows[0]?.max_id ?? 0)
  } catch {
    return 0
  }
}

export async function pollNotifications(
  instance: string,
  afterId: number
): Promise<{ id: number; phone: string | null }[]> {
  try {
    await ensureTable()
    const { rows } = await pool.query<{ id: number; phone: string | null }>(
      'SELECT id, phone FROM _comagente_notify WHERE instance = $1 AND id > $2 ORDER BY id ASC LIMIT 20',
      [instance, afterId]
    )
    return rows.map(r => ({ id: Number(r.id), phone: r.phone }))
  } catch {
    return []
  }
}
