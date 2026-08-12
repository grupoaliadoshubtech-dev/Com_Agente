// lib/supabase/client.ts
// Singleton pg.Pool para o Supabase (usado por todos os repositórios).
// SSL requerido pelo Supabase; rejectUnauthorized=false para compatibilidade
// com certificados wildcard *.supabase.co no ambiente serverless da Vercel.
// Pool é lazy — só é criado na primeira query, nunca durante o build.

import { Pool } from 'pg'

declare global {
  // Permite reusar a pool entre hot-reloads no Next.js dev
  // eslint-disable-next-line no-var
  var __supabasePool: Pool | undefined
}

function getPool(): Pool {
  if (global.__supabasePool) return global.__supabasePool
  const url = process.env.SUPABASE_DATABASE_URL
  if (!url) throw new Error('[Supabase] SUPABASE_DATABASE_URL não configurado.')
  global.__supabasePool = new Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  })
  return global.__supabasePool
}

/** Helper: executa uma query com parâmetros e retorna as linhas. */
export async function query<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  values?: unknown[]
): Promise<T[]> {
  const { rows } = await getPool().query<T>(text, values)
  return rows
}

/** Helper: executa uma query que retorna no máximo uma linha. */
export async function queryOne<T extends Record<string, unknown> = Record<string, unknown>>(
  text: string,
  values?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, values)
  return rows[0] ?? null
}

/** Helper: executa sem retorno de linhas (INSERT/UPDATE/DELETE). */
export async function execute(text: string, values?: unknown[]): Promise<void> {
  await getPool().query(text, values)
}
