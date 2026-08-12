// lib/repositories/blacklist.repository.ts
// Migrado de Google Sheets → Supabase (schema do tenant)

import { query, execute } from '@/lib/supabase/client'

export interface BlacklistRecord {
  telefone:  string
  motivo:    string
  atendente: string
  timestamp: string
}

export class BlacklistRepository {
  constructor(private schema: string) {}

  async findAll(): Promise<BlacklistRecord[]> {
    try {
      const rows = await query(
        `SELECT telefone, motivo, atendente, timestamp FROM ${this.schema}.blacklist ORDER BY timestamp DESC`
      )
      return rows.map(r => ({
        telefone:  String(r.telefone ?? ''),
        motivo:    String(r.motivo ?? ''),
        atendente: String(r.atendente ?? ''),
        timestamp: r.timestamp ? new Date(r.timestamp as string).toISOString() : '',
      }))
    } catch {
      return []
    }
  }

  async add(telefone: string, motivo: string, atendenteId: string): Promise<void> {
    await execute(
      `INSERT INTO ${this.schema}.blacklist (telefone, motivo, atendente, timestamp)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (telefone) DO UPDATE SET motivo = EXCLUDED.motivo, atendente = EXCLUDED.atendente, timestamp = NOW()`,
      [telefone, motivo, atendenteId]
    )
  }

  async isBlocked(telefone: string): Promise<boolean> {
    try {
      const rows = await query(
        `SELECT 1 FROM ${this.schema}.blacklist WHERE telefone = $1 LIMIT 1`,
        [telefone]
      )
      return rows.length > 0
    } catch {
      return false
    }
  }

  async remove(telefone: string): Promise<void> {
    await execute(`DELETE FROM ${this.schema}.blacklist WHERE telefone = $1`, [telefone])
  }
}
