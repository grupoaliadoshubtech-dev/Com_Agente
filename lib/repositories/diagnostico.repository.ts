// ─────────────────────────────────────────────────────────────
// lib/repositories/diagnostico.repository.ts
//
// Aba "Diagnosticos" da planilha MASTER.
// Colunas: id | leadId | token | status | responses | createdAt | respondedAt
// ─────────────────────────────────────────────────────────────

import { readRange, appendRows, updateRange, rowsToObjects } from '@/lib/sheets/client'
import type { DiagnosticoRecord } from '@/types'
import { randomUUID } from 'crypto'

const MASTER_ID = process.env.GOOGLE_MASTER_SHEET_ID!
const SHEET     = 'Diagnosticos'

export class DiagnosticoRepository {
  private spreadsheetId = MASTER_ID

  private parse(raw: Record<string, string>): DiagnosticoRecord {
    return {
      id:          raw.id,
      leadId:      raw.leadId,
      token:       raw.token,
      status:      (raw.status ?? 'pending') as DiagnosticoRecord['status'],
      responses:   raw.responses ?? '',
      createdAt:   raw.createdAt,
      respondedAt: raw.respondedAt ?? '',
    }
  }

  async create(leadId: string): Promise<DiagnosticoRecord> {
    const record: DiagnosticoRecord = {
      id:          randomUUID(),
      leadId,
      token:       randomUUID(),
      status:      'pending',
      responses:   '',
      createdAt:   new Date().toISOString(),
      respondedAt: '',
    }
    await appendRows(this.spreadsheetId, `${SHEET}!A:G`, [[
      record.id,
      record.leadId,
      record.token,
      record.status,
      record.responses,
      record.createdAt,
      record.respondedAt,
    ]])
    return record
  }

  async findAll(): Promise<DiagnosticoRecord[]> {
    const rows = await readRange(this.spreadsheetId, `${SHEET}!A:G`)
    return rowsToObjects<Record<string, string>>(rows).map(r => this.parse(r))
  }

  async findByToken(token: string): Promise<DiagnosticoRecord | null> {
    const all = await this.findAll()
    return all.find(d => d.token === token) ?? null
  }

  async findByLeadId(leadId: string): Promise<DiagnosticoRecord | null> {
    const all = await this.findAll()
    return all.find(d => d.leadId === leadId) ?? null
  }

  async saveResponses(token: string, responses: Record<string, string>): Promise<boolean> {
    const rows = await readRange(this.spreadsheetId, `${SHEET}!A:G`)
    if (rows.length < 2) return false
    const headers   = rows[0]
    const tokenCol  = headers.indexOf('token')
    const rowIndex  = rows.findIndex((r, i) => i > 0 && r[tokenCol] === token)
    if (rowIndex === -1) return false
    const sheetRow  = rowIndex + 1
    const statusCol = String.fromCharCode(65 + headers.indexOf('status'))
    const respCol   = String.fromCharCode(65 + headers.indexOf('responses'))
    const respAtCol = String.fromCharCode(65 + headers.indexOf('respondedAt'))
    await Promise.all([
      updateRange(this.spreadsheetId, `${SHEET}!${statusCol}${sheetRow}`,  [['answered']]),
      updateRange(this.spreadsheetId, `${SHEET}!${respCol}${sheetRow}`,    [[JSON.stringify(responses)]]),
      updateRange(this.spreadsheetId, `${SHEET}!${respAtCol}${sheetRow}`,  [[new Date().toISOString()]]),
    ])
    return true
  }
}
