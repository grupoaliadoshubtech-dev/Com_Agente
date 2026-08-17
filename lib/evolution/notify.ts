// lib/evolution/notify.ts
// Tabela leve no Supabase usada para sinalizar eventos ao frontend via SSE.
// Suporta notificações de mensagem nova (type='message') e alertas de sistema
// (type='uso_limite', etc.).
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
})

let tableReady = false

async function ensureTable(): Promise<void> {
  if (tableReady) return
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _comagente_notify (
      id         BIGSERIAL PRIMARY KEY,
      instance   TEXT NOT NULL,
      phone      TEXT,
      type       TEXT NOT NULL DEFAULT 'message',
      payload    JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  // Adiciona colunas novas em tabelas existentes sem type/payload
  await pool.query(`ALTER TABLE _comagente_notify ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'message'`)
  await pool.query(`ALTER TABLE _comagente_notify ADD COLUMN IF NOT EXISTS payload JSONB`)
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
      'INSERT INTO _comagente_notify (instance, phone, type) VALUES ($1, $2, $3)',
      [instance, phone, 'message'] as unknown[]
    )
    pool.query(
      `DELETE FROM _comagente_notify WHERE created_at < now() - interval '60 seconds'`
    ).catch(() => {})
  } catch {
    // Não crítico
  }
}

export async function pushSystemNotification(
  instance: string,
  type: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    await ensureTable()
    await pool.query(
      'INSERT INTO _comagente_notify (instance, phone, type, payload) VALUES ($1, $2, $3, $4)',
      [instance, null, type, JSON.stringify(payload)] as unknown[]
    )
  } catch {
    // Não crítico
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

export interface NotifyRow {
  id:      number
  phone:   string | null
  type:    string
  payload: Record<string, unknown> | null
}

export async function pollNotifications(
  instance: string,
  afterId: number
): Promise<NotifyRow[]> {
  try {
    await ensureTable()
    const { rows } = await pool.query<{ id: number; phone: string | null; type: string; payload: Record<string, unknown> | null }>(
      'SELECT id, phone, type, payload FROM _comagente_notify WHERE instance = $1 AND id > $2 ORDER BY id ASC LIMIT 20',
      [instance, afterId]
    )
    return rows.map(r => ({
      id:      Number(r.id),
      phone:   r.phone,
      type:    r.type ?? 'message',
      payload: r.payload ?? null,
    }))
  } catch {
    return []
  }
}
