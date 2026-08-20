// lib/supabase/db.ts
// Singleton pg.Pool para o Supabase (usado por repositórios no servidor).

import { Pool } from 'pg'

declare global {
  // eslint-disable-next-line no-var
  var __supabasePool: Pool | undefined
}

function getPool(): Pool {
  if (global.__supabasePool) return global.__supabasePool
  const url = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL
  if (!url) throw new Error('[Supabase] SUPABASE_DATABASE_URL ou DATABASE_URL não configurado.')
  global.__supabasePool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  })
  return global.__supabasePool
}

export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  values?: unknown[]
): Promise<T[]> {
  const { rows } = await getPool().query<T>(text, values)
  return rows
}

export async function queryOne<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  values?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, values)
  return rows[0] ?? null
}

export async function execute(text: string, values?: unknown[]): Promise<void> {
  await getPool().query(text, values)
}
