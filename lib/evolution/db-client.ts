// lib/evolution/db-client.ts
// Acesso direto ao PostgreSQL da Evolution API para buscar mensagens recebidas
// (contorna bug da Evolution API que retorna apenas fromMe: true)

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

export async function findAllMessages(
  remoteJid: string,
  instanceId: string,
  limit = 50
): Promise<DBMessage[]> {
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
