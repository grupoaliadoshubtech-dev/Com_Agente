import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Pool, PoolClient } from 'pg'

export const dynamic = 'force-dynamic'

function makeEvolutionPool() {
  return new Pool({
    connectionString: process.env.EVOLUTION_DB_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 8000,
  })
}

function makeSupabasePool() {
  return new Pool({
    connectionString: process.env.SUPABASE_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 8000,
  })
}

// Executa uma query com fallback seguro
async function safeQuery<T extends Record<string, unknown>>(client: PoolClient, sql: string, params: unknown[] = []): Promise<T[]> {
  try {
    const res = await client.query<T>(sql, params)
    return res.rows
  } catch {
    return []
  }
}

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'master') {
    return NextResponse.json({ success: false, error: 'Apenas Master Admin' }, { status: 403 })
  }

  const [supabaseResult, r2Result, msgResult] = await Promise.allSettled([
    getSupabaseMetrics(),
    getR2Metrics(),
    getMessageMetrics(),
  ])

  return NextResponse.json({
    success: true,
    data: {
      supabase: supabaseResult.status === 'fulfilled' ? supabaseResult.value : null,
      r2:       r2Result.status       === 'fulfilled' ? r2Result.value       : null,
      messages: msgResult.status      === 'fulfilled' ? msgResult.value      : null,
    },
    errors: {
      supabase: supabaseResult.status === 'rejected' ? String(supabaseResult.reason) : null,
      r2:       r2Result.status       === 'rejected' ? String(r2Result.reason)       : null,
      messages: msgResult.status      === 'rejected' ? String(msgResult.reason)      : null,
    },
  })
}

// ─── Supabase / Evolution API: tamanho do banco, tabelas e instâncias ──
async function getSupabaseMetrics() {
  const pool = makeEvolutionPool()
  const client = await pool.connect()
  try {
    // Cada query é independente — falha individual não derruba as demais
    const [connRows, dbSizeRows, tablesRows, instanceRows] = await Promise.all([
      safeQuery<{ active: string; idle: string; waiting: string; total: string }>(client, `
        SELECT
          count(*) FILTER (WHERE state = 'active')              AS active,
          count(*) FILTER (WHERE state = 'idle')                AS idle,
          count(*) FILTER (WHERE state = 'idle in transaction') AS waiting,
          count(*)                                              AS total
        FROM pg_stat_activity
        WHERE datname = current_database()
      `),
      safeQuery<{ db_size: string }>(client, `
        SELECT pg_database_size(current_database()) AS db_size
      `),
      // information_schema é mais acessível que pg_stat_user_tables no pooler
      safeQuery<{ table_name: string; total_bytes: string; live_rows: string }>(client, `
        SELECT
          t.table_name,
          COALESCE(pg_total_relation_size('"' || t.table_name || '"'), 0) AS total_bytes,
          COALESCE(s.n_live_tup, 0)                                       AS live_rows
        FROM information_schema.tables t
        LEFT JOIN pg_stat_user_tables s ON s.relname = t.table_name
        WHERE t.table_schema = 'public'
          AND t.table_type = 'BASE TABLE'
        ORDER BY pg_total_relation_size('"' || t.table_name || '"') DESC NULLS LAST
        LIMIT 5
      `),
      safeQuery<{ name: string; connectionStatus: string }>(client, `
        SELECT name, "connectionStatus" FROM "Instance" ORDER BY name
      `),
    ])

    const conn = connRows[0]
    const dbSize = dbSizeRows[0]

    return {
      connections: {
        active:  parseInt(conn?.active  ?? '0'),
        idle:    parseInt(conn?.idle    ?? '0'),
        waiting: parseInt(conn?.waiting ?? '0'),
        total:   parseInt(conn?.total   ?? '0'),
      },
      dbSizeBytes: parseInt(dbSize?.db_size ?? '0'),
      tables: tablesRows.map(r => ({
        name:       r.table_name,
        totalBytes: parseInt(r.total_bytes ?? '0'),
        liveRows:   parseInt(r.live_rows   ?? '0'),
      })),
      instances: instanceRows,
    }
  } finally {
    client.release()
    await pool.end()
  }
}

// ─── Cloudflare R2: storage via Analytics GraphQL ────────────
async function getR2Metrics() {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN
  if (!apiToken) throw new Error('Variável não encontrada: CLOUDFLARE_API_TOKEN')

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!accountId) throw new Error('Variável não encontrada: CLOUDFLARE_ACCOUNT_ID')

  const until = new Date()
  const since = new Date(Date.now() - 30 * 86_400_000)
  const fmt   = (d: Date) => d.toISOString().split('T')[0]

  const query = `{
    viewer {
      accounts(filter: { accountTag: "${accountId}" }) {
        r2StorageAdaptiveGroups(
          filter: { date_geq: "${fmt(since)}", date_leq: "${fmt(until)}" }
          limit: 10000
          orderBy: [date_DESC]
        ) {
          max {
            objectCount
            payloadSize
            metadataSize
          }
        }
      }
    }
  }`

  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(12_000),
  })

  const json = await res.json()

  if (json?.errors?.length) {
    throw new Error(`CF_ERR: ${json.errors[0]?.message ?? 'unknown'} | account=${accountId?.slice(0,8)}...`)
  }

  const groups: Array<{ max: { objectCount: number; payloadSize: number; metadataSize: number } }> =
    json?.data?.viewer?.accounts?.[0]?.r2StorageAdaptiveGroups ?? []

  if (!groups.length) return { objectCount: 0, storageBytes: 0 }

  const { objectCount, payloadSize, metadataSize } = groups[0].max
  return {
    objectCount:  objectCount  ?? 0,
    storageBytes: (payloadSize ?? 0) + (metadataSize ?? 0),
  }
}

// ─── Mensagens: _comagente_notify (Supabase) + erros upload (Evolution) ──
async function getMessageMetrics() {
  const notifyPool    = makeSupabasePool()
  const evolutionPool = makeEvolutionPool()

  const [notifyClient, evolutionClient] = await Promise.all([
    notifyPool.connect(),
    evolutionPool.connect(),
  ])

  try {
    const [perMinRows, perHourRows, uploadErrRows] = await Promise.all([
      safeQuery<{ count: string }>(notifyClient, `
        SELECT count(*) AS count
        FROM _comagente_notify
        WHERE created_at > now() - interval '1 minute'
      `),
      safeQuery<{ count: string }>(notifyClient, `
        SELECT count(*) AS count
        FROM _comagente_notify
        WHERE created_at > now() - interval '1 hour'
      `),
      // message já é jsonb — sem cast explícito
      safeQuery<{ count: string }>(evolutionClient, `
        SELECT count(*) AS count
        FROM "Message"
        WHERE "messageTimestamp" > EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours')
          AND "messageType" IN (
            'imageMessage','audioMessage','videoMessage',
            'documentMessage','stickerMessage'
          )
          AND message ? 'base64'
      `),
    ])

    return {
      perMinute:    parseInt(perMinRows[0]?.count    ?? '0'),
      perHour:      parseInt(perHourRows[0]?.count   ?? '0'),
      uploadErrors: parseInt(uploadErrRows[0]?.count ?? '0'),
    }
  } finally {
    notifyClient.release()
    evolutionClient.release()
    await Promise.allSettled([notifyPool.end(), evolutionPool.end()])
  }
}
