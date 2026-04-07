// ─────────────────────────────────────────────────────────────
// lib/repositories/blacklist.repository.ts
//
// Aba "Blacklist" da planilha do tenant.
// Colunas: telefone | motivo | atendenteId | timestamp
// ─────────────────────────────────────────────────────────────

import { readRange, appendRows, rowsToObjects } from '@/lib/sheets/client'

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
}
