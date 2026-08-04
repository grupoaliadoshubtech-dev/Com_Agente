// ─────────────────────────────────────────────────────────────
// lib/repositories/agendamentos.repository.ts
//
// Lê a aba "Agendamentos" da planilha do tenant.
// Colunas são flexíveis — cada cliente pode ter campos diferentes.
// A coluna de data e de status são detectadas automaticamente.
// ─────────────────────────────────────────────────────────────

import { readRange, updateRange } from '@/lib/sheets/client'
import type { AgendamentosData, AgendamentoRow } from '@/types'

const SHEET = 'Agendamentos'

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
  constructor(private spreadsheetId: string) {}

  async findAll(): Promise<AgendamentosData> {
    let rows: string[][]
    try {
      rows = await readRange(this.spreadsheetId, `${SHEET}!A:Z`)
    } catch {
      return { headers: [], dateCol: null, statusCol: null, records: [] }
    }

    if (rows.length < 2) {
      return { headers: rows[0] ?? [], dateCol: null, statusCol: null, records: [] }
    }

    const headers   = rows[0].filter(Boolean)
    const dateCol   = detectDateCol(headers)
    const statusCol = detectStatusCol(headers)

    const records: AgendamentoRow[] = rows
      .slice(1)
      .map((r, i) => {
        const row: AgendamentoRow = { _rowIndex: i + 2 } // +2: 1-based + skip header
        headers.forEach((h, col) => { row[h] = r[col] ?? '' })
        return row
      })
      .filter(r =>
        // descarta linhas completamente vazias
        headers.some(h => String(r[h] ?? '').trim() !== '')
      )

    return { headers, dateCol, statusCol, records }
  }

  async update(rowIndex: number, updates: Record<string, string>): Promise<void> {
    const headerRow = await readRange(this.spreadsheetId, `${SHEET}!A1:Z1`)
    const headers   = headerRow[0] ?? []

    const promises: Promise<void>[] = []
    for (const [header, value] of Object.entries(updates)) {
      const col = headers.indexOf(header)
      if (col === -1) continue
      const colLetter = col < 26
        ? String.fromCharCode(65 + col)
        : `A${String.fromCharCode(65 + col - 26)}` // suporte A-Z + AA-AZ
      promises.push(
        updateRange(this.spreadsheetId, `${SHEET}!${colLetter}${rowIndex}`, [[value]])
      )
    }
    await Promise.all(promises)
  }
}
