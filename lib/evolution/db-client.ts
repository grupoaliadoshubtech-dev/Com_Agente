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
  if (cached && Date.now() - cached.ts < 300000) return cached.id // cache 5 min

  const result = await pool.query<{ id: string }>(
    `SELECT id FROM "Instance" WHERE name = $1 LIMIT 1`,
    [instanceName]
  )
  if (!result.rows[0]) return null
  instanceIdCache.set(instanceName, { id: result.rows[0].id, ts: Date.now() })
  return result.rows[0].id
}

export async function findAllMessages(
  remoteJid: string,
  instanceName: string,
  limit = 50
): Promise<DBMessage[]> {
  const instanceId = await getInstanceId(instanceName)
  if (!instanceId) return []

  const result = await pool.query<{
    key: DBMessage['key']
    pushName: string
    message: Record<string, unknown>
    messageTimestamp: number
    messageType: string
  }>(
    `SELECT key, "pushName", message, "messageTimestamp", "messageType"
     FROM "Message"
     WHERE "key"->>'remoteJid' = $1
       AND "instanceId" = $2
     ORDER BY "messageTimestamp" DESC
     LIMIT $3`,
    [remoteJid, instanceId, limit]
  )

  return result.rows.map(row => ({
    key: row.key,
    pushName: row.pushName,
    message: row.message,
    messageTimestamp: row.messageTimestamp,
    messageType: row.messageType,
  }))
}
