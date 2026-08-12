// lib/repositories/agendamentos.repository.ts
// Migrado de Google Sheets → Supabase (schema do tenant)
// Tabela: agendamentos (id BIGSERIAL, data JSONB)
// Campos ficam em data JSONB; _rowIndex = id da linha.

import { query, execute } from '@/lib/supabase/client'
import type { AgendamentosData, AgendamentoRow } from '@/types'

const SHEET = 'agendamentos'

function detectDateCol(headers: string[]): string | null {
  return (
    headers.find(h => /^data_evento$/i.test(h)) ??
    headers.find(h => /^data$/i.test(h)) ??
    headers.find(h => /data/i.test(h)) ??
    null
  )
}

function detectStatusCol(headers: string[]): string | null {
  return (
    headers.find(h => /^status$/i.test(h)) ??
    headers.find(h => /status|situa[çc]|estado/i.test(h)) ??
    null
  )
}

export class AgendamentosRepository {
  constructor(private schema: string) {}

  async findAll(): Promise<AgendamentosData> {
    try {
      const rows = await query(`SELECT id, data FROM ${this.schema}.${SHEET} ORDER BY id`)

      if (rows.length === 0) {
        return { headers: [], dateCol: null, statusCol: null, records: [] }
      }

      // Coleta todos os headers presentes nos JSONB
      const allKeys = new Set<string>()
      for (const row of rows) {
        const data = (row.data ?? {}) as Record<string, unknown>
        Object.keys(data).forEach(k => allKeys.add(k))
      }
      const headers   = Array.from(allKeys)
      const dateCol   = detectDateCol(headers)
      const statusCol = detectStatusCol(headers)

      const records: AgendamentoRow[] = rows.map(row => {
        const data: AgendamentoRow = { _rowIndex: Number(row.id) }
        const jsonData = (row.data ?? {}) as Record<string, unknown>
        headers.forEach(h => { data[h] = String(jsonData[h] ?? '') })
        return data
      })

      return { headers, dateCol, statusCol, records }
    } catch {
      return { headers: [], dateCol: null, statusCol: null, records: [] }
    }
  }

  async update(rowId: number, updates: Record<string, string>): Promise<void> {
    // Faz merge do JSONB existente com os campos atualizados
    await execute(
      `UPDATE ${this.schema}.${SHEET}
       SET data = data || $1::jsonb, updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(updates), rowId]
    )
  }
}
