// ─────────────────────────────────────────────────────────────
// lib/repositories/templates.repository.ts
// FASE 5 — Repositório de respostas rápidas/templates.
//
// Aba "Templates" na planilha do tenant:
// A: id | B: atalho | C: titulo | D: mensagem | E: categoria
// F: criadoPor | G: createdAt | H: isActive
// ─────────────────────────────────────────────────────────────

import { readRange, appendRows, updateRange, rowsToObjects } from '@/lib/sheets/client'
import { randomUUID } from 'crypto'

export interface TemplateRecord {
  id:         string
  atalho:     string    // ex: /saudacao, /preco, /horario
  titulo:     string    // nome curto para exibição
  mensagem:   string    // texto completo da mensagem
  categoria:  string    // ex: geral, vendas, suporte, follow-up
  criadoPor:  string    // ID do supervisor que criou
  createdAt:  string
  isActive:   boolean
}

const SHEET = 'Templates'
const RANGE = `${SHEET}!A:H`

export class TemplatesRepository {
  constructor(private spreadsheetId: string) {}

  private parse(raw: Record<string, string>): TemplateRecord {
    return {
      id:        raw.id        ?? '',
      atalho:    raw.atalho    ?? raw.Atalho    ?? '',
      titulo:    raw.titulo    ?? raw.Titulo    ?? '',
      mensagem:  raw.mensagem  ?? raw.Mensagem  ?? '',
      categoria: raw.categoria ?? raw.Categoria ?? 'geral',
      criadoPor: raw.criadoPor ?? raw.CriadoPor ?? '',
      createdAt: raw.createdAt ?? raw.CreatedAt ?? '',
      isActive:  raw.isActive !== 'FALSE',
    }
  }

  async findAll(): Promise<TemplateRecord[]> {
    try {
      const rows = await readRange(this.spreadsheetId, RANGE)
      return rowsToObjects<Record<string, string>>(rows)
        .map(r => this.parse(r))
        .filter(t => t.isActive)
    } catch {
      return [] // Aba pode não existir ainda
    }
  }

  async findByAtalho(atalho: string): Promise<TemplateRecord | null> {
    const all = await this.findAll()
    const normalized = atalho.startsWith('/') ? atalho : `/${atalho}`
    return all.find(t => t.atalho.toLowerCase() === normalized.toLowerCase()) ?? null
  }

  async findByCategoria(categoria: string): Promise<TemplateRecord[]> {
    const all = await this.findAll()
    return all.filter(t => t.categoria.toLowerCase() === categoria.toLowerCase())
  }

  async create(data: {
    atalho: string; titulo: string; mensagem: string
    categoria?: string; criadoPor: string
  }): Promise<TemplateRecord> {
    const template: TemplateRecord = {
      id:        randomUUID(),
      atalho:    data.atalho.startsWith('/') ? data.atalho : `/${data.atalho}`,
      titulo:    data.titulo,
      mensagem:  data.mensagem,
      categoria: data.categoria ?? 'geral',
      criadoPor: data.criadoPor,
      createdAt: new Date().toISOString(),
      isActive:  true,
    }

    await appendRows(this.spreadsheetId, RANGE, [[
      template.id,
      template.atalho,
      template.titulo,
      template.mensagem,
      template.categoria,
      template.criadoPor,
      template.createdAt,
      'TRUE',
    ]])

    return template
  }

  async update(id: string, updates: Partial<Pick<TemplateRecord, 'atalho' | 'titulo' | 'mensagem' | 'categoria'>>): Promise<void> {
    const rows = await readRange(this.spreadsheetId, RANGE)
    if (rows.length < 2) return

    const headers = rows[0]
    const idCol = headers.findIndex(h => h.toLowerCase() === 'id')
    const rowIndex = rows.findIndex((r, i) => i > 0 && r[idCol] === id)
    if (rowIndex === -1) return

    const sheetRow = rowIndex + 1
    const currentRow = [...rows[rowIndex]]
    const fieldMap: Record<string, number> = {}
    headers.forEach((h, i) => { fieldMap[h.toLowerCase()] = i })

    if (updates.atalho !== undefined && fieldMap['atalho'] !== undefined)
      currentRow[fieldMap['atalho']] = updates.atalho.startsWith('/') ? updates.atalho : `/${updates.atalho}`
    if (updates.titulo !== undefined && fieldMap['titulo'] !== undefined)
      currentRow[fieldMap['titulo']] = updates.titulo
    if (updates.mensagem !== undefined && fieldMap['mensagem'] !== undefined)
      currentRow[fieldMap['mensagem']] = updates.mensagem
    if (updates.categoria !== undefined && fieldMap['categoria'] !== undefined)
      currentRow[fieldMap['categoria']] = updates.categoria

    await updateRange(this.spreadsheetId, `${SHEET}!A${sheetRow}:H${sheetRow}`, [currentRow])
  }

  async delete(id: string): Promise<void> {
    const rows = await readRange(this.spreadsheetId, RANGE)
    if (rows.length < 2) return

    const headers = rows[0]
    const idCol = headers.findIndex(h => h.toLowerCase() === 'id')
    const activeCol = headers.findIndex(h => h.toLowerCase() === 'isactive')
    const rowIndex = rows.findIndex((r, i) => i > 0 && r[idCol] === id)
    if (rowIndex === -1) return

    const sheetRow = rowIndex + 1
    const colLetter = String.fromCharCode(65 + activeCol)
    await updateRange(this.spreadsheetId, `${SHEET}!${colLetter}${sheetRow}`, [['FALSE']])
  }
}
