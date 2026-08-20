// lib/repositories/handoff.repository.ts
// Migrado de Google Sheets → Supabase (schema do tenant)
// Tabela: fila_humana
//   id | telefone | status | timestamp | atendente

import { query, execute } from '@/lib/supabase/db'
import type { HandoffRecord } from '@/types'

export class HandoffRepository {
  constructor(private schema: string) {}

  async pausar(telefone: string, atendenteId: string): Promise<void> {
    await execute(
      `INSERT INTO ${this.schema}.fila_humana (telefone, status, timestamp, atendente)
       VALUES ($1, 'pausado', NOW(), $2)`,
      [telefone, atendenteId]
    )
  }

  async pausaGlobal(atendenteId: string): Promise<void> {
    await this.pausar('ALL', atendenteId)
  }

  async retomar(telefone: string): Promise<void> {
    await execute(
      `DELETE FROM ${this.schema}.fila_humana WHERE telefone = $1`,
      [telefone]
    )
  }

  async getStatus(telefone: string): Promise<'pausado' | 'ativo'> {
    const rows = await query(
      `SELECT 1 FROM ${this.schema}.fila_humana
       WHERE telefone = $1 OR telefone = 'ALL'
       LIMIT 1`,
      [telefone]
    )
    return rows.length > 0 ? 'pausado' : 'ativo'
  }

  async getAll(): Promise<HandoffRecord[]> {
    const rows = await query(
      `SELECT telefone, status, timestamp, atendente
       FROM ${this.schema}.fila_humana
       ORDER BY timestamp DESC`
    )
    return rows.map(r => ({
      telefone:  String(r.telefone),
      status:    'pausado' as HandoffRecord['status'],
      timestamp: r.timestamp ? new Date(r.timestamp as string).toISOString() : '',
      atendente: String(r.atendente ?? ''),
    }))
  }
}
