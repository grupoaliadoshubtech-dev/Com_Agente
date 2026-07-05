// ─────────────────────────────────────────────────────────────
// lib/repositories/blacklist.repository.ts
//
// Aba "Blacklist" da planilha do tenant.
// Colunas: telefone | motivo | atendenteId | timestamp
// ─────────────────────────────────────────────────────────────

import { readRange, appendRows, rowsToObjects, deleteRows, getSheetId } from '@/lib/sheets/client'

export interface BlacklistRecord {
  telefone:   string
  motivo:     string
  atendente:  string
  timestamp:  string
}

export class BlacklistRepository {
  private sheet = 'Blacklist'

  constructor(private spreadsheetId: string) {}

  async findAll(): Promise<BlacklistRecord[]> {
    const rows = await readRange(this.spreadsheetId, `${this.sheet}!A:D`)
    return rowsToObjects<Record<string, string>>(rows).map(r => ({
      telefone:  r.telefone ?? r.Telefone ?? '',
      motivo:    r.motivo   ?? r.Motivo   ?? '',
      atendente: r.atendente ?? r.Atendente ?? '',
      timestamp: r.timestamp ?? r.Timestamp ?? '',
    }))
  }

  async add(telefone: string, motivo: string, atendenteId: string): Promise<void> {
    await appendRows(this.spreadsheetId, `${this.sheet}!A:D`, [[
      telefone,
      motivo,
      atendenteId,
      new Date().toISOString(),
    ]])
  }

  async isBlocked(telefone: string): Promise<boolean> {
    const all = await this.findAll()
    return all.some(r => r.telefone === telefone)
  }

  async remove(telefone: string): Promise<void> {
    const rows = await readRange(this.spreadsheetId, `${this.sheet}!A:D`)
    if (rows.length < 2) return
    const indices = rows
      .map((r, i) => (i > 0 && r[0] === telefone ? i : -1))
      .filter(i => i !== -1)
      .sort((a, b) => b - a) // decrescente para não shiftar índices
    if (indices.length === 0) return
    const sheetId = await getSheetId(this.spreadsheetId, this.sheet)
    await deleteRows(this.spreadsheetId, sheetId, indices)
  }
}
