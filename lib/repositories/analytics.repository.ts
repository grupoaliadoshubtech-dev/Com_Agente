// ─────────────────────────────────────────────────────────────
// lib/repositories/analytics.repository.ts
//
// Repositório de leitura para todas as abas view-only:
//   Atendimentos · Satisfacao · Clientes (CRM)
//
// ZERO botões de edição/exclusão — apenas leitura conforme spec.
// ─────────────────────────────────────────────────────────────

import { readRange, rowsToObjects } from '@/lib/sheets/client'
import type { AtendimentoRecord, SatisfacaoRecord, ClientRecord } from '@/types'

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

  /** Métricas agregadas para o dashboard */
  async getMetrics(): Promise<{
    total:          number
    hoje:           number
    semana:         number
    porAtendente:   Record<string, number>
    mediaMinutos:   number
    taxaHumano:     number   // % de atendimentos que tiveram humano
  }> {
    const all   = await this.findAll()
    const now   = new Date()
    const today = now.toISOString().slice(0, 10)
    const weekAgo = new Date(now.getTime() - 7 * 86400_000).toISOString()

    const hoje   = all.filter(a => a.inicio.startsWith(today)).length
    const semana = all.filter(a => a.inicio >= weekAgo).length

    const porAtendente: Record<string, number> = {}
    let totalMinutos  = 0
    let comMinutos    = 0
    let comHumano     = 0

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
      total:        all.length,
      hoje,
      semana,
      porAtendente,
      mediaMinutos: comMinutos > 0 ? Math.round(totalMinutos / comMinutos) : 0,
      taxaHumano:   all.length > 0 ? Math.round((comHumano / all.length) * 100) : 0,
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
    media:       number
    total:       number
    distribuicao: Record<number, number>   // { 1: N, 2: N, ... 5: N }
    tendencia:   Array<{ data: string; media: number }>
  }> {
    const all  = await this.findAll()
    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    let soma   = 0

    for (const s of all) {
      const n = Math.round(s.nota)
      if (n >= 1 && n <= 5) { dist[n]++; soma += s.nota }
    }

    // Tendência: média por dia (últimos 14 dias)
    const byDay: Record<string, number[]> = {}
    for (const s of all) {
      const day = s.timestamp.slice(0, 10)
      if (!byDay[day]) byDay[day] = []
      byDay[day].push(s.nota)
    }
    const tendencia = Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([data, notas]) => ({
        data,
        media: Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10,
      }))

    return {
      media: all.length > 0
        ? Math.round((soma / all.length) * 10) / 10
        : 0,
      total: all.length,
      distribuicao: dist,
      tendencia,
    }
  }
}

// ── CRM / Clientes ────────────────────────────────────────────

export class ClientesRepository {
  constructor(private spreadsheetId: string) {}

  async findAll(): Promise<ClientRecord[]> {
    const rows = await readRange(this.spreadsheetId, 'Clientes!A:D')
    return rowsToObjects<Record<string, string>>(rows).map(r => ({
      telefone: r.telefone ?? r.Telefone ?? '',
      nome:     r.nome     ?? r.Nome     ?? '',
      status:   r.status   ?? r.Status   ?? '',
      historico:r.historico?? r.Historico?? '',
    }))
  }

  async findByPhone(telefone: string): Promise<ClientRecord | null> {
    const all = await this.findAll()
    return all.find(c => c.telefone === telefone) ?? null
  }

  async getMetrics(): Promise<{
    total:      number
    porStatus:  Record<string, number>
    novosHoje:  number
  }> {
    // Clientes não têm createdAt próprio — usa atendimentos como proxy
    const all = await this.findAll()
    const porStatus: Record<string, number> = {}
    for (const c of all) {
      const key = c.status || 'sem status'
      porStatus[key] = (porStatus[key] ?? 0) + 1
    }
    return { total: all.length, porStatus, novosHoje: 0 }
  }
}
