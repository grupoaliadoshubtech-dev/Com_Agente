import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { Pool } from 'pg'

export const dynamic = 'force-dynamic'

function makePool() {
  return new Pool({
    connectionString: process.env.EVOLUTION_DB_URL,
    ssl: { rejectUnauthorized: false },
    max: 2,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 8000,
  })
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
      supabase:  supabaseResult.status  === 'fulfilled' ? supabaseResult.value  : null,
      r2:        r2Result.status        === 'fulfilled' ? r2Result.value        : null,
      messages:  msgResult.status       === 'fulfilled' ? msgResult.value       : null,
    },
    errors: {
      supabase: supabaseResult.status === 'rejected' ? String(supabaseResult.reason) : null,
      r2:       r2Result.status       === 'rejected' ? String(r2Result.reason)       : null,
      messages: msgResult.status      === 'rejected' ? String(msgResult.reason)      : null,
    },
  })
}

// ─── Supabase: conexões, tamanho do banco e tabelas ──────────
async function getSupabaseMetrics() {
  const pool = makePool()
  try {
    const client = await pool.connect()
    try {
      const [connRes, dbSizeRes, tablesRes, instanceRes] = await Promise.all([
        client.query<{ active: string; idle: string; waiting: string; total: string }>(`
          SELECT
            count(*) FILTER (WHERE state = 'active')               AS active,
            count(*) FILTER (WHERE state = 'idle')                 AS idle,
            count(*) FILTER (WHERE state = 'idle in transaction')  AS waiting,
            count(*)                                               AS total
          FROM pg_stat_activity
          WHERE datname = current_database()
        `),
        client.query<{ db_size: string }>(`
          SELECT pg_database_size(current_database()) AS db_size
        `),
        client.query<{ table_name: string; total_bytes: string; live_rows: string }>(`
          SELECT
            relname                                      AS table_name,
            pg_total_relation_size(oid)                 AS total_bytes,
            COALESCE(n_live_tup, 0)                    AS live_rows
          FROM pg_stat_user_tables
          ORDER BY pg_total_relation_size(oid) DESC
          LIMIT 5
        `),
        client.query<{ name: string; connectionStatus: string }>(`
          SELECT name, "connectionStatus"
          FROM "Instance"
          ORDER BY name
        `),
      ])

      return {
        connections: {
          active:  parseInt(connRes.rows[0]?.active  ?? '0'),
          idle:    parseInt(connRes.rows[0]?.idle    ?? '0'),
          waiting: parseInt(connRes.rows[0]?.waiting ?? '0'),
          total:   parseInt(connRes.rows[0]?.total   ?? '0'),
        },
        dbSizeBytes: parseInt(dbSizeRes.rows[0]?.db_size ?? '0'),
        tables: tablesRes.rows.map(r => ({
          name:       r.table_name,
          totalBytes: parseInt(r.total_bytes),
          liveRows:   parseInt(r.live_rows),
        })),
        instances: instanceRes.rows,
      }
    } finally {
      client.release()
    }
  } finally {
    await pool.end()
  }
}

// ─── Cloudflare R2: storage e número de arquivos ─────────────
async function getR2Metrics() {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const apiToken  = process.env.CLOUDFLARE_API_TOKEN
  if (!accountId || !apiToken) return null

  const today     = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split('T')[0]

  const query = `{
    viewer {
      accounts(filter: { accountTag: "${accountId}" }) {
        r2StorageAdaptiveGroups(
          filter: { date_geq: "${yesterday}", date_leq: "${today}" }
          limit: 1
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
    headers: {
      Authorization:  `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(10_000),
  })

  const json = await res.json()
  const groups = json?.data?.viewer?.accounts?.[0]?.r2StorageAdaptiveGroups ?? []

  if (!groups.length) return { objectCount: 0, storageBytes: 0 }

  const { objectCount, payloadSize, metadataSize } = groups[0].max
  return {
    objectCount:  objectCount  ?? 0,
    storageBytes: (payloadSize ?? 0) + (metadataSize ?? 0),
  }
}

// ─── Mensagens: volume (_comagente_notify) e erros de upload (Message) ──
// ATENÇÃO: _comagente_notify fica no SUPABASE_DATABASE_URL (banco do ComAgente)
//          Message fica no EVOLUTION_DB_URL (banco da Evolution API)
async function getMessageMetrics() {
  const notifyPool = new Pool({
    connectionString: process.env.SUPABASE_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 8000,
  })
  const evolutionPool = makePool()

  try {
    const [notifyClient, evolutionClient] = await Promise.all([
      notifyPool.connect(),
      evolutionPool.connect(),
    ])

    try {
      const [perMinRes, perHourRes, uploadErrRes] = await Promise.all([
        notifyClient.query<{ count: string }>(`
          SELECT count(*) AS count
          FROM _comagente_notify
          WHERE created_at > now() - interval '1 minute'
        `),
        notifyClient.query<{ count: string }>(`
          SELECT count(*) AS count
          FROM _comagente_notify
          WHERE created_at > now() - interval '1 hour'
        `),
        // message já é jsonb — sem cast; mídias com base64 = upload ao R2 falhou
        evolutionClient.query<{ count: string }>(`
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
        perMinute:    parseInt(perMinRes.rows[0]?.count    ?? '0'),
        perHour:      parseInt(perHourRes.rows[0]?.count   ?? '0'),
        uploadErrors: parseInt(uploadErrRes.rows[0]?.count ?? '0'),
      }
    } finally {
      notifyClient.release()
      evolutionClient.release()
    }
  } finally {
    await Promise.allSettled([notifyPool.end(), evolutionPool.end()])
  }
}
