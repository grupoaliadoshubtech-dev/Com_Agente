// ─────────────────────────────────────────────────────────────
// lib/repositories/distribution.repository.ts
// FASE 6 — Distribuição automática de atendimentos.
//
// Aba "Distribuicao" na planilha do tenant:
// A: atendenteId | B: atendenteNome | C: atendentePhone
// D: online | E: especialidade | F: maxConversas
// G: conversasAtivas | H: ultimaAtribuicao | I: totalAtribuidos
//
// Lógica round-robin com regras:
// - Só atribui para atendentes online
// - Respeita capacidade máxima (maxConversas)
// - Pode filtrar por especialidade
// - Atribui para quem tem menos conversas ativas
// - Em empate, usa quem foi atribuído há mais tempo
// ─────────────────────────────────────────────────────────────

import { readRange, appendRows, updateRange, rowsToObjects } from '@/lib/sheets/client'
import { UsersRepository } from './users.repository'

export interface DistributionRecord {
  atendenteId:       string
  atendenteNome:     string
  atendentePhone:    string
  online:            boolean
  especialidade:     string    // ex: "vendas", "suporte", "geral"
  maxConversas:      number
  conversasAtivas:   number
  ultimaAtribuicao:  string    // ISO date
  totalAtribuidos:   number
}

export interface AtribuicaoLog {
  id:            string
  telefoneCliente: string
  atendenteId:   string
  atendenteNome: string
  timestamp:     string
  motivo:        string    // "round-robin", "especialidade", "manual"
}

const SHEET = 'Distribuicao'
const RANGE = `${SHEET}!A:I`
const LOG_SHEET = 'Log_Distribuicao'
const LOG_RANGE = `${LOG_SHEET}!A:F`

export class DistributionRepository {
  constructor(private spreadsheetId: string) {}

  // ── Leitura ────────────────────────────────────────────────

  async findAll(): Promise<DistributionRecord[]> {
    try {
      const rows = await readRange(this.spreadsheetId, RANGE)
      return rowsToObjects<Record<string, string>>(rows).map(r => ({
        atendenteId:      r.atendenteId      ?? r.AtendenteId      ?? '',
        atendenteNome:    r.atendenteNome    ?? r.AtendenteNome    ?? '',
        atendentePhone:   r.atendentePhone   ?? r.AtendentePhone   ?? '',
        online:           r.online === 'TRUE' || r.Online === 'TRUE',
        especialidade:    r.especialidade    ?? r.Especialidade    ?? 'geral',
        maxConversas:     Number(r.maxConversas ?? r.MaxConversas ?? 5),
        conversasAtivas:  Number(r.conversasAtivas ?? r.ConversasAtivas ?? 0),
        ultimaAtribuicao: r.ultimaAtribuicao ?? r.UltimaAtribuicao ?? '',
        totalAtribuidos:  Number(r.totalAtribuidos ?? r.TotalAtribuidos ?? 0),
      }))
    } catch {
      return []
    }
  }

  async findOnline(): Promise<DistributionRecord[]> {
    const all = await this.findAll()
    return all.filter(a => a.online)
  }

  async findAvailable(especialidade?: string): Promise<DistributionRecord[]> {
    const online = await this.findOnline()
    let available = online.filter(a => a.conversasAtivas < a.maxConversas)
    if (especialidade && especialidade !== 'geral') {
      const specialists = available.filter(a =>
        a.especialidade.toLowerCase().includes(especialidade.toLowerCase())
      )
      if (specialists.length > 0) available = specialists
    }
    return available
  }

  // ── Distribuição round-robin ───────────────────────────────

  /**
   * Seleciona o próximo atendente disponível usando round-robin.
   * Prioridade: menos conversas ativas → última atribuição mais antiga.
   */
  async getNextAttendant(especialidade?: string): Promise<DistributionRecord | null> {
    const available = await this.findAvailable(especialidade)
    if (available.length === 0) return null

    // Ordena: menos conversas primeiro, em empate, quem foi atribuído há mais tempo
    available.sort((a, b) => {
      if (a.conversasAtivas !== b.conversasAtivas) {
        return a.conversasAtivas - b.conversasAtivas
      }
      const tA = a.ultimaAtribuicao ? new Date(a.ultimaAtribuicao).getTime() : 0
      const tB = b.ultimaAtribuicao ? new Date(b.ultimaAtribuicao).getTime() : 0
      return tA - tB
    })

    return available[0]
  }

  /**
   * Atribui um cliente a um atendente.
   * Incrementa conversas ativas e total, atualiza timestamp.
   */
  async atribuir(atendenteId: string, telefoneCliente: string, motivo = 'round-robin'): Promise<void> {
    const rows = await readRange(this.spreadsheetId, RANGE)
    if (rows.length < 2) return

    const headers = rows[0]
    const idCol = headers.findIndex(h => h.toLowerCase() === 'atendenteid')
    const rowIndex = rows.findIndex((r, i) => i > 0 && r[idCol] === atendenteId)
    if (rowIndex === -1) return

    const sheetRow = rowIndex + 1
    const currentRow = [...rows[rowIndex]]
    const fieldMap: Record<string, number> = {}
    headers.forEach((h, i) => { fieldMap[h.toLowerCase()] = i })

    const conversasAtivas = Number(currentRow[fieldMap['conversasativas'] ?? 6] ?? 0) + 1
    const totalAtribuidos = Number(currentRow[fieldMap['totalatribuidos'] ?? 8] ?? 0) + 1

    if (fieldMap['conversasativas'] !== undefined)
      currentRow[fieldMap['conversasativas']] = String(conversasAtivas)
    if (fieldMap['ultimaatribuicao'] !== undefined)
      currentRow[fieldMap['ultimaatribuicao']] = new Date().toISOString()
    if (fieldMap['totalatribuidos'] !== undefined)
      currentRow[fieldMap['totalatribuidos']] = String(totalAtribuidos)

    await updateRange(this.spreadsheetId, `${SHEET}!A${sheetRow}:I${sheetRow}`, [currentRow])

    // Log da atribuição
    await this.logAtribuicao(telefoneCliente, atendenteId, currentRow[fieldMap['atendentenome'] ?? 1] ?? '', motivo)
  }

  /**
   * Libera uma conversa de um atendente (decrementa conversas ativas).
   */
  async liberar(atendenteId: string): Promise<void> {
    const rows = await readRange(this.spreadsheetId, RANGE)
    if (rows.length < 2) return

    const headers = rows[0]
    const idCol = headers.findIndex(h => h.toLowerCase() === 'atendenteid')
    const rowIndex = rows.findIndex((r, i) => i > 0 && r[idCol] === atendenteId)
    if (rowIndex === -1) return

    const sheetRow = rowIndex + 1
    const fieldMap: Record<string, number> = {}
    headers.forEach((h, i) => { fieldMap[h.toLowerCase()] = i })

    const col = fieldMap['conversasativas']
    if (col === undefined) return
    const current = Math.max(0, Number(rows[rowIndex][col] ?? 0) - 1)
    const colLetter = String.fromCharCode(65 + col)
    await updateRange(this.spreadsheetId, `${SHEET}!${colLetter}${sheetRow}`, [[String(current)]])
  }

  // ── Status online/offline ──────────────────────────────────

  async setOnline(atendenteId: string, online: boolean): Promise<void> {
    const rows = await readRange(this.spreadsheetId, RANGE)
    if (rows.length < 2) return

    const headers = rows[0]
    const idCol = headers.findIndex(h => h.toLowerCase() === 'atendenteid')
    const rowIndex = rows.findIndex((r, i) => i > 0 && r[idCol] === atendenteId)
    if (rowIndex === -1) return

    const sheetRow = rowIndex + 1
    const fieldMap: Record<string, number> = {}
    headers.forEach((h, i) => { fieldMap[h.toLowerCase()] = i })

    const col = fieldMap['online']
    if (col === undefined) return
    const colLetter = String.fromCharCode(65 + col)
    await updateRange(this.spreadsheetId, `${SHEET}!${colLetter}${sheetRow}`, [[online ? 'TRUE' : 'FALSE']])

    // Se ficou offline, zera conversas ativas
    if (!online) {
      const convCol = fieldMap['conversasativas']
      if (convCol !== undefined) {
        const convLetter = String.fromCharCode(65 + convCol)
        await updateRange(this.spreadsheetId, `${SHEET}!${convLetter}${sheetRow}`, [['0']])
      }
    }
  }

  // ── Configuração ───────────────────────────────────────────

  async updateConfig(atendenteId: string, updates: {
    especialidade?: string; maxConversas?: number
  }): Promise<void> {
    const rows = await readRange(this.spreadsheetId, RANGE)
    if (rows.length < 2) return

    const headers = rows[0]
    const idCol = headers.findIndex(h => h.toLowerCase() === 'atendenteid')
    const rowIndex = rows.findIndex((r, i) => i > 0 && r[idCol] === atendenteId)
    if (rowIndex === -1) return

    const sheetRow = rowIndex + 1
    const currentRow = [...rows[rowIndex]]
    const fieldMap: Record<string, number> = {}
    headers.forEach((h, i) => { fieldMap[h.toLowerCase()] = i })

    if (updates.especialidade !== undefined && fieldMap['especialidade'] !== undefined)
      currentRow[fieldMap['especialidade']] = updates.especialidade
    if (updates.maxConversas !== undefined && fieldMap['maxconversas'] !== undefined)
      currentRow[fieldMap['maxconversas']] = String(updates.maxConversas)

    await updateRange(this.spreadsheetId, `${SHEET}!A${sheetRow}:I${sheetRow}`, [currentRow])
  }

  // ── Sincroniza com a aba Usuarios ──────────────────────────

  async syncFromUsers(): Promise<void> {
    const usersRepo = new UsersRepository(this.spreadsheetId)
    const users = await usersRepo.findAll()
    const attendants = users.filter(u => u.role === 'atendente' || u.role === 'supervisor')
    const existing = await this.findAll()
    const existingIds = new Set(existing.map(e => e.atendenteId))

    for (const user of attendants) {
      if (existingIds.has(user.id)) continue
      await appendRows(this.spreadsheetId, RANGE, [[
        user.id,
        user.name,
        user.phone ?? '',
        'FALSE',
        'geral',
        '5',
        '0',
        '',
        '0',
      ]])
    }
  }

  // ── Log de atribuição ──────────────────────────────────────

  private async logAtribuicao(telefoneCliente: string, atendenteId: string, atendenteNome: string, motivo: string): Promise<void> {
    try {
      await appendRows(this.spreadsheetId, LOG_RANGE, [[
        `dist_${Date.now()}`,
        telefoneCliente,
        atendenteId,
        atendenteNome,
        new Date().toISOString(),
        motivo,
      ]])
    } catch {
      console.error('[Distribution] Erro ao gravar log')
    }
  }

  // ── Métricas ───────────────────────────────────────────────

  async getMetrics(): Promise<{
    totalOnline: number
    totalOffline: number
    totalConversasAtivas: number
    capacidadeTotal: number
    capacidadeUsada: number
    atendentes: DistributionRecord[]
  }> {
    const all = await this.findAll()
    const online = all.filter(a => a.online)
    const totalConversas = all.reduce((s, a) => s + a.conversasAtivas, 0)
    const capacidade = online.reduce((s, a) => s + a.maxConversas, 0)

    return {
      totalOnline: online.length,
      totalOffline: all.length - online.length,
      totalConversasAtivas: totalConversas,
      capacidadeTotal: capacidade,
      capacidadeUsada: capacidade > 0 ? Math.round((totalConversas / capacidade) * 100) : 0,
      atendentes: all,
    }
  }
}
