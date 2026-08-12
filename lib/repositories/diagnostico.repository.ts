// lib/repositories/diagnostico.repository.ts
// Migrado de Google Sheets → Supabase (schema: app)

import { query, queryOne, execute } from '@/lib/supabase/client'
import type { DiagnosticoRecord } from '@/types'
import { randomUUID } from 'crypto'

function parse(row: Record<string, unknown>): DiagnosticoRecord {
  return {
    id:          String(row.id),
    leadId:      String(row.lead_id),
    token:       String(row.token),
    status:      (row.status ?? 'pending') as DiagnosticoRecord['status'],
    responses:   row.responses
      ? (typeof row.responses === 'string' ? row.responses : JSON.stringify(row.responses))
      : '',
    createdAt:   row.created_at   ? new Date(row.created_at as string).toISOString()   : '',
    respondedAt: row.responded_at ? new Date(row.responded_at as string).toISOString() : '',
  }
}

export class DiagnosticoRepository {
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
    await execute(
      `INSERT INTO app.diagnosticos (id, lead_id, token, status, responses, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [record.id, record.leadId, record.token, record.status, '{}', record.createdAt]
    )
    return record
  }

  async findAll(): Promise<DiagnosticoRecord[]> {
    const rows = await query('SELECT * FROM app.diagnosticos ORDER BY created_at DESC')
    return rows.map(parse)
  }

  async findByToken(token: string): Promise<DiagnosticoRecord | null> {
    const row = await queryOne(
      'SELECT * FROM app.diagnosticos WHERE token = $1',
      [token]
    )
    return row ? parse(row) : null
  }

  async findByLeadId(leadId: string): Promise<DiagnosticoRecord | null> {
    const row = await queryOne(
      'SELECT * FROM app.diagnosticos WHERE lead_id = $1',
      [leadId]
    )
    return row ? parse(row) : null
  }

  async saveResponses(token: string, responses: Record<string, string>): Promise<boolean> {
    const rows = await query<{ id: string }>(
      `UPDATE app.diagnosticos
       SET status = 'answered', responses = $1, responded_at = NOW()
       WHERE token = $2 AND status = 'pending'
       RETURNING id`,
      [JSON.stringify(responses), token]
    )
    return rows.length > 0
  }
}
