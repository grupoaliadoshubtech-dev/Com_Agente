// lib/evolution/db-client.ts
import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.EVOLUTION_DB_URL,
})

export interface DBMessage {
  key: {
    id: string
    fromMe: boolean
    remoteJid: string
  }
  pushName?: string
  message?: Record<string, unknown>
  messageTimestamp?: number
  messageType?: string
  status?: string
}

// Cache de instanceId por nome de instância
const instanceIdCache = new Map<string, { id: string; ts: number }>()

export async function getInstanceId(instanceName: string): Promise<string | null> {
  const cached = instanceIdCache.get(instanceName)
  if (cached && Date.now() - cached.ts < 300000) return cached.id

  const result = await pool.query<{ id: string }>(
    `SELECT id FROM "Instance" WHERE name = $1 LIMIT 1`,
    [instanceName]
  )
  if (!result.rows[0]) return null
  instanceIdCache.set(instanceName, { id: result.rows[0].id, ts: Date.now() })
  return result.rows[0].id
}

// Cache do mapeamento lid → phone
const lidMappingCache = new Map<string, { map: Map<string, string>; ts: number }>()

export async function getLidMapping(instanceName: string): Promise<Map<string, string>> {
  const cached = lidMappingCache.get(instanceName)
  if (cached && Date.now() - cached.ts < 300000) return cached.map

  const instanceId = await getInstanceId(instanceName)
  if (!instanceId) return new Map()

  // Estratégia 1: mensagens enviadas (fromMe=true) armazenadas com @lid
  // têm o mesmo remoteJid que mensagens recebidas do mesmo contato
  // Buscamos pares @lid ↔ @s.whatsapp.net via Chat ou Message onde ambos existam
  const result = await pool.query<{ lid: string; phone: string }>(
    `SELECT DISTINCT
       m1."key"->>'remoteJid' AS lid,
       m2."key"->>'remoteJid' AS phone
     FROM "Message" m1
     JOIN "Message" m2
       ON m1."key"->>'id' = m2."key"->>'id'
      AND m1."instanceId" = m2."instanceId"
     WHERE m1."instanceId" = $1
       AND m1."key"->>'remoteJid' LIKE '%@lid'
       AND m2."key"->>'remoteJid' LIKE '%@s.whatsapp.net'
     LIMIT 500`,
    [instanceId]
  )

  const map = new Map<string, string>()
  for (const row of result.rows) {
    if (row.lid && row.phone) map.set(row.lid, row.phone)
  }

  // Estratégia 2 (fallback): busca direta na tabela Chat se existir
  if (map.size === 0) {
    try {
      const chatResult = await pool.query<{ lid: string; phone: string }>(
        `SELECT DISTINCT
           "remoteJid" AS lid,
           "phoneNumber" AS phone
         FROM "Chat"
         WHERE "instanceId" = $1
           AND "remoteJid" LIKE '%@lid'
           AND "phoneNumber" IS NOT NULL
         LIMIT 500`,
        [instanceId]
      )
      for (const row of chatResult.rows) {
        if (row.lid && row.phone) map.set(row.lid, row.phone)
      }
    } catch {
      // Chat table ou coluna pode não existir nessa versão do Evolution API
    }
  }

  lidMappingCache.set(instanceName, { map, ts: Date.now() })
  return map
}

// Persiste mensagem recebida (fromMe=false) no PostgreSQL da Evolution API.
// Necessário porque o Evolution API pode não salvar mensagens recebidas por padrão.
export async function saveReceivedMessage(
  msg: {
    key: { id: string; fromMe: boolean; remoteJid: string }
    pushName?: string
    message?: Record<string, unknown>
    messageTimestamp?: number | string
    messageType?: string
  },
  instanceName: string
): Promise<void> {
  try {
    const instanceId = await getInstanceId(instanceName)
    if (!instanceId) return

    const ts = msg.messageTimestamp
      ? (typeof msg.messageTimestamp === 'string'
          ? parseInt(msg.messageTimestamp, 10)
          : msg.messageTimestamp)
      : Math.floor(Date.now() / 1000)

    await pool.query<Record<string, never>>(
      `INSERT INTO "Message"
         ("key", "pushName", "message", "messageTimestamp", "messageType", "instanceId")
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT DO NOTHING`,
      [
        JSON.stringify(msg.key),
        msg.pushName ?? null,
        JSON.stringify(msg.message ?? {}),
        ts,
        msg.messageType ?? 'conversation',
        instanceId,
      ]
    )
  } catch (err) {
    // Silencia erros de conflito ou constraint — a mensagem pode já existir
    console.warn('[db-client] saveReceivedMessage:', String(err).slice(0, 120))
  }
}

export async function findAllMessages(
  remoteJids: string[],
  instanceName: string,
  limit = 50
): Promise<DBMessage[]> {
  const instanceId = await getInstanceId(instanceName)
  if (!instanceId) return []

  const placeholders = remoteJids.map((_, i) => `$${i + 1}`).join(', ')

  const result = await pool.query<{
    key: DBMessage['key']
    pushName: string
    message: Record<string, unknown>
    messageTimestamp: number
    messageType: string
    status: string | null
  }>(
    `SELECT key, "pushName", message, "messageTimestamp", "messageType",
            COALESCE("status", NULL) AS status
     FROM "Message"
     WHERE "key"->>'remoteJid' IN (${placeholders})
       AND "instanceId" = $${remoteJids.length + 1}
     ORDER BY "messageTimestamp" ASC
     LIMIT $${remoteJids.length + 2}`,
    [...remoteJids, instanceId, limit]
  )

  return result.rows.map(row => ({
    key: row.key,
    pushName: row.pushName,
    message: row.message,
    messageTimestamp: row.messageTimestamp,
    messageType: row.messageType,
    status: row.status ?? undefined,
  }))
}