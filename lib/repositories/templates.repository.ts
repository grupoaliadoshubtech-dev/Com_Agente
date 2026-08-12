// lib/repositories/templates.repository.ts
// Migrado de Google Sheets → Supabase (schema do tenant)

import { query, queryOne, execute } from '@/lib/supabase/client'
import { randomUUID } from 'crypto'

export interface TemplateRecord {
  id:        string
  atalho:    string
  titulo:    string
  mensagem:  string
  categoria: string
  criadoPor: string
  createdAt: string
  isActive:  boolean
}

function parse(row: Record<string, unknown>): TemplateRecord {
  return {
    id:        String(row.id),
    atalho:    String(row.atalho ?? ''),
    titulo:    String(row.titulo ?? ''),
    mensagem:  String(row.mensagem ?? ''),
    categoria: String(row.categoria ?? 'geral'),
    criadoPor: String(row.criado_por ?? ''),
    createdAt: row.created_at ? new Date(row.created_at as string).toISOString() : '',
    isActive:  Boolean(row.is_active),
  }
}

export class TemplatesRepository {
  constructor(private schema: string) {}

  async findAll(): Promise<TemplateRecord[]> {
    try {
      const rows = await query(
        `SELECT * FROM ${this.schema}.templates WHERE is_active = true ORDER BY atalho`
      )
      return rows.map(parse)
    } catch {
      return []
    }
  }

  async findByAtalho(atalho: string): Promise<TemplateRecord | null> {
    const normalized = atalho.startsWith('/') ? atalho : `/${atalho}`
    try {
      const row = await queryOne(
        `SELECT * FROM ${this.schema}.templates WHERE LOWER(atalho) = LOWER($1) AND is_active = true`,
        [normalized]
      )
      return row ? parse(row) : null
    } catch {
      return null
    }
  }

  async findByCategoria(categoria: string): Promise<TemplateRecord[]> {
    try {
      const rows = await query(
        `SELECT * FROM ${this.schema}.templates WHERE LOWER(categoria) = LOWER($1) AND is_active = true ORDER BY atalho`,
        [categoria]
      )
      return rows.map(parse)
    } catch {
      return []
    }
  }

  async create(data: {
    atalho: string; titulo: string; mensagem: string
    categoria?: string; criadoPor: string
  }): Promise<TemplateRecord> {
    const id     = randomUUID()
    const atalho = data.atalho.startsWith('/') ? data.atalho : `/${data.atalho}`
    const now    = new Date().toISOString()

    await execute(
      `INSERT INTO ${this.schema}.templates (id, atalho, titulo, mensagem, categoria, criado_por, created_at, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)`,
      [id, atalho, data.titulo, data.mensagem, data.categoria ?? 'geral', data.criadoPor, now]
    )

    return {
      id, atalho, titulo: data.titulo, mensagem: data.mensagem,
      categoria: data.categoria ?? 'geral', criadoPor: data.criadoPor,
      createdAt: now, isActive: true,
    }
  }

  async update(id: string, updates: Partial<Pick<TemplateRecord, 'atalho' | 'titulo' | 'mensagem' | 'categoria'>>): Promise<void> {
    const sets: string[]  = []
    const vals: unknown[] = []
    let   idx             = 1

    if (updates.atalho   !== undefined) { sets.push(`atalho = $${idx++}`);   vals.push(updates.atalho.startsWith('/') ? updates.atalho : `/${updates.atalho}`) }
    if (updates.titulo   !== undefined) { sets.push(`titulo = $${idx++}`);   vals.push(updates.titulo) }
    if (updates.mensagem !== undefined) { sets.push(`mensagem = $${idx++}`); vals.push(updates.mensagem) }
    if (updates.categoria !== undefined) { sets.push(`categoria = $${idx++}`); vals.push(updates.categoria) }

    if (sets.length === 0) return
    vals.push(id)
    await execute(`UPDATE ${this.schema}.templates SET ${sets.join(', ')} WHERE id = $${idx}`, vals)
  }

  async delete(id: string): Promise<void> {
    await execute(`UPDATE ${this.schema}.templates SET is_active = false WHERE id = $1`, [id])
  }
}
