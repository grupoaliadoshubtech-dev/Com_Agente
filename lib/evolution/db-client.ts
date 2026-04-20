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
  }>(
    `SELECT key, "pushName", message, "messageTimestamp", "messageType"
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
  }))
}
