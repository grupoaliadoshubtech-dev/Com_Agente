// ─────────────────────────────────────────────────────────────
// lib/repositories/analytics.repository.ts
// FASE 4: ClientesRepository com suporte a funil, tags,
// follow-up, update de etapa e notas.
// ─────────────────────────────────────────────────────────────

import { readRange, updateRange, appendRows, rowsToObjects } from '@/lib/sheets/client'
import type { AtendimentoRecord, SatisfacaoRecord, ClientRecord, CRMStage } from '@/types'

// ── Atendimentos ──────────────────────────────────────────────

export class AtendimentosRepository {
  constructor(private spreadsheetId: string) {}

  async findAll(): Promise<AtendimentoRecord[]> {
    const rows = await readRange(this.spreadsheetId, 'Atendimentos!A:H')
    return rowsToObjects<Record<string, string>>(rows).map(r => ({
      id:         r.id        ?? '',
      telefone:   r.telefone  ?? '',
      nome:       r.nome      ?? '',
      inicio:     r.inicio    ?? '',
      fim:        r.fim       ?? '',
      duracao:    r.duracao   ?? '',
      atendente:  r.atendente ?? 'Bot',
      satisfacao: r.satisfacao ? Number(r.satisfacao) : undefined,
    }))
  }

  async findByPhone(telefone: string): Promise<AtendimentoRecord[]> {
    const all = await this.findAll()
    return all.filter(a => a.telefone === telefone)
  }

  async getMetrics(): Promise<{
    total: number; hoje: number; semana: number
    porAtendente: Record<string, number>; mediaMinutos: number; taxaHumano: number
  }> {
    const all   = await this.findAll()
    const now   = new Date()
    const today = now.toISOString().slice(0, 10)
    const weekAgo = new Date(now.getTime() - 7 * 86400_000).toISOString()
    const hoje   = all.filter(a => a.inicio.startsWith(today)).length
    const semana = all.filter(a => a.inicio >= weekAgo).length
    const porAtendente: Record<string, number> = {}
    let totalMinutos = 0, comMinutos = 0, comHumano = 0
    for (const a of all) {
      const key = a.atendente || 'Bot'
      porAtendente[key] = (porAtendente[key] ?? 0) + 1
      if (a.inicio && a.fim) {
        const mins = (new Date(a.fim).getTime() - new Date(a.inicio).getTime()) / 60000
        if (mins > 0 && mins < 480) { totalMinutos += mins; comMinutos++ }
      }
      if (a.atendente && a.atendente !== 'Bot') comHumano++
    }
    return {
      total: all.length, hoje, semana, porAtendente,
      mediaMinutos: comMinutos > 0 ? Math.round(totalMinutos / comMinutos) : 0,
      taxaHumano: all.length > 0 ? Math.round((comHumano / all.length) * 100) : 0,
    }
  }
}

// ── Satisfação ────────────────────────────────────────────────

export class SatisfacaoRepository {
  constructor(private spreadsheetId: string) {}

  async findAll(): Promise<SatisfacaoRecord[]> {
    const rows = await readRange(this.spreadsheetId, 'Satisfacao!A:E')
    return rowsToObjects<Record<string, string>>(rows).map(r => ({
      timestamp:     r.timestamp     ?? '',
      telefone:      r.telefone      ?? '',
      nota:          Number(r.nota ?? 0),
      atendimentoId: r.atendimentoId ?? '',
      atendente:     r.atendente     ?? 'Bot',
    }))
  }

  async getMetrics(): Promise<{
    media: number; total: number
    distribuicao: Record<number, number>
    tendencia: Array<{ data: string; media: number }>
  }> {
    const all  = await this.findAll()
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    let soma = 0
    for (const s of all) {
      const n = Math.round(s.nota)
      if (n >= 1 && n <= 5) { dist[n]++; soma += s.nota }
    }
    const byDay: Record<string, number[]> = {}
    for (const s of all) {
      const day = s.timestamp.slice(0, 10)
      if (!byDay[day]) byDay[day] = []
      byDay[day].push(s.nota)
    }
    const tendencia = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b)).slice(-14)
      .map(([data, notas]) => ({
        data, media: Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10,
      }))
    return {
      media: all.length > 0 ? Math.round((soma / all.length) * 10) / 10 : 0,
      total: all.length, distribuicao: dist, tendencia,
    }
  }
}

// ── CRM / Clientes — FASE 4 ──────────────────────────────────
// Planilha Clientes expandida:
// A: telefone | B: nome | C: status | D: historico
// E: etapa | F: tags | G: ultimoContato | H: proximoFollowUp
// I: valorEstimado | J: atendente | K: notas | L: origem | M: createdAt

export class ClientesRepository {
  constructor(private spreadsheetId: string) {}

  async findAll(): Promise<ClientRecord[]> {
    const rows = await readRange(this.spreadsheetId, 'Clientes!A:M')
    return rowsToObjects<Record<string, string>>(rows).map(r => ({
      telefone:        r.telefone        ?? r.Telefone        ?? '',
      nome:            r.nome            ?? r.Nome            ?? '',
      status:          r.status          ?? r.Status          ?? '',
      historico:       r.historico       ?? r.Historico       ?? '',
      etapa:           (r.etapa          ?? r.Etapa           ?? 'novo') as CRMStage,
      tags:            r.tags            ?? r.Tags            ?? '',
      ultimoContato:   r.ultimoContato   ?? r.UltimoContato   ?? '',
      proximoFollowUp: r.proximoFollowUp ?? r.ProximoFollowUp ?? '',
      valorEstimado:   r.valorEstimado   ?? r.ValorEstimado   ?? '',
      atendente:       r.atendente       ?? r.Atendente       ?? '',
      notas:           r.notas           ?? r.Notas           ?? '',
      origem:          r.origem          ?? r.Origem          ?? '',
      createdAt:       r.createdAt       ?? r.CreatedAt       ?? '',
    }))
  }

  async findByPhone(telefone: string): Promise<ClientRecord | null> {
    const all = await this.findAll()
    return all.find(c => c.telefone === telefone) ?? null
  }

  async findByStage(etapa: CRMStage): Promise<ClientRecord[]> {
    const all = await this.findAll()
    return all.filter(c => c.etapa === etapa)
  }

  async findOverdueFollowUps(): Promise<ClientRecord[]> {
    const all = await this.findAll()
    const now = new Date().toISOString()
    return all.filter(c =>
      c.proximoFollowUp && c.proximoFollowUp < now && c.etapa !== 'fechado' && c.etapa !== 'perdido'
    )
  }

  async updateClient(telefone: string, updates: Partial<ClientRecord>): Promise<void> {
    const rows = await readRange(this.spreadsheetId, 'Clientes!A:M')
    if (rows.length < 2) return

    const headers = rows[0]
    const phoneCol = headers.findIndex(h => h.toLowerCase() === 'telefone')
    const rowIndex = rows.findIndex((r, i) => i > 0 && r[phoneCol] === telefone)

    if (rowIndex === -1) return

    const sheetRow = rowIndex + 1

    // Monta a linha atualizada preservando valores existentes
    const currentRow = rows[rowIndex]
    const fieldMap: Record<string, number> = {}
    headers.forEach((h, i) => { fieldMap[h.toLowerCase()] = i })

    const updatedRow = [...currentRow]

    if (updates.etapa !== undefined && fieldMap['etapa'] !== undefined)
      updatedRow[fieldMap['etapa']] = updates.etapa
    if (updates.tags !== undefined && fieldMap['tags'] !== undefined)
      updatedRow[fieldMap['tags']] = updates.tags
    if (updates.ultimoContato !== undefined && fieldMap['ultimocontato'] !== undefined)
      updatedRow[fieldMap['ultimocontato']] = updates.ultimoContato
    if (updates.proximoFollowUp !== undefined && fieldMap['proximofollowup'] !== undefined)
      updatedRow[fieldMap['proximofollowup']] = updates.proximoFollowUp
    if (updates.valorEstimado !== undefined && fieldMap['valorestimado'] !== undefined)
      updatedRow[fieldMap['valorestimado']] = updates.valorEstimado
    if (updates.atendente !== undefined && fieldMap['atendente'] !== undefined)
      updatedRow[fieldMap['atendente']] = updates.atendente
    if (updates.notas !== undefined && fieldMap['notas'] !== undefined)
      updatedRow[fieldMap['notas']] = updates.notas
    if (updates.status !== undefined && fieldMap['status'] !== undefined)
      updatedRow[fieldMap['status']] = updates.status

    await updateRange(this.spreadsheetId, `Clientes!A${sheetRow}:M${sheetRow}`, [updatedRow])
  }

  async addClient(client: ClientRecord): Promise<void> {
    await appendRows(this.spreadsheetId, 'Clientes!A:M', [[
      client.telefone,
      client.nome,
      client.status ?? '',
      client.historico ?? '',
      client.etapa ?? 'novo',
      client.tags ?? '',
      client.ultimoContato ?? new Date().toISOString(),
      client.proximoFollowUp ?? '',
      client.valorEstimado ?? '',
      client.atendente ?? '',
      client.notas ?? '',
      client.origem ?? 'WhatsApp',
      client.createdAt ?? new Date().toISOString(),
    ]])
  }

  async getMetrics(): Promise<{
    total: number; porStatus: Record<string, number>
    porEtapa: Record<string, number>; overdueFollowUps: number; novosHoje: number
  }> {
    const all = await this.findAll()
    const porStatus: Record<string, number> = {}
    const porEtapa: Record<string, number> = {}
    const today = new Date().toISOString().slice(0, 10)
    const now = new Date().toISOString()
    let overdueFollowUps = 0

    for (const c of all) {
      const sk = c.status || 'sem status'
      porStatus[sk] = (porStatus[sk] ?? 0) + 1
      const ek = c.etapa || 'novo'
      porEtapa[ek] = (porEtapa[ek] ?? 0) + 1
      if (c.proximoFollowUp && c.proximoFollowUp < now && c.etapa !== 'fechado' && c.etapa !== 'perdido')
        overdueFollowUps++
    }

    return {
      total: all.length, porStatus, porEtapa, overdueFollowUps,
      novosHoje: all.filter(c => c.createdAt?.startsWith(today)).length,
    }
  }
}
