// lib/repositories/analytics.repository.ts
// Migrado de Google Sheets → Supabase (schema do tenant)

import { query, execute } from '@/lib/supabase/db'
import type { AtendimentoRecord, SatisfacaoRecord, ClientRecord, CRMStage } from '@/types'

// ── Atendimentos ──────────────────────────────────────────────

export class AtendimentosRepository {
  constructor(private schema: string) {}

  async findAll(): Promise<AtendimentoRecord[]> {
    try {
      const rows = await query(
        `SELECT id, telefone, nome, inicio, fim, duracao, atendente, satisfacao
         FROM ${this.schema}.atendimentos ORDER BY inicio DESC`
      )
      return rows.map(r => ({
        id:         String(r.id ?? ''),
        telefone:   String(r.telefone ?? ''),
        nome:       String(r.nome ?? ''),
        inicio:     r.inicio ? new Date(r.inicio as string).toISOString() : '',
        fim:        r.fim    ? new Date(r.fim    as string).toISOString() : '',
        duracao:    String(r.duracao ?? ''),
        atendente:  String(r.atendente ?? 'Bot'),
        satisfacao: r.satisfacao !== null ? Number(r.satisfacao) : undefined,
      }))
    } catch {
      return []
    }
  }

  async findByPhone(telefone: string): Promise<AtendimentoRecord[]> {
    try {
      const rows = await query(
        `SELECT * FROM ${this.schema}.atendimentos WHERE telefone = $1 ORDER BY inicio DESC`,
        [telefone]
      )
      return rows.map(r => ({
        id:         String(r.id ?? ''),
        telefone:   String(r.telefone ?? ''),
        nome:       String(r.nome ?? ''),
        inicio:     r.inicio ? new Date(r.inicio as string).toISOString() : '',
        fim:        r.fim    ? new Date(r.fim    as string).toISOString() : '',
        duracao:    String(r.duracao ?? ''),
        atendente:  String(r.atendente ?? 'Bot'),
        satisfacao: r.satisfacao !== null ? Number(r.satisfacao) : undefined,
      }))
    } catch {
      return []
    }
  }

  async getMetrics(): Promise<{
    total: number; hoje: number; semana: number
    porAtendente: Record<string, number>; mediaMinutos: number; taxaHumano: number
  }> {
    const all     = await this.findAll()
    const now     = new Date()
    const today   = now.toISOString().slice(0, 10)
    const weekAgo = new Date(now.getTime() - 7 * 86400_000).toISOString()
    const hoje    = all.filter(a => a.inicio.startsWith(today)).length
    const semana  = all.filter(a => a.inicio >= weekAgo).length
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
      taxaHumano:   all.length > 0 ? Math.round((comHumano / all.length) * 100) : 0,
    }
  }
}

// ── Satisfação ────────────────────────────────────────────────

export class SatisfacaoRepository {
  constructor(private schema: string) {}

  async findAll(): Promise<SatisfacaoRecord[]> {
    try {
      const rows = await query(
        `SELECT timestamp, telefone, nota, atendimento_id, atendente
         FROM ${this.schema}.satisfacao ORDER BY timestamp DESC`
      )
      return rows.map(r => ({
        timestamp:     r.timestamp ? new Date(r.timestamp as string).toISOString() : '',
        telefone:      String(r.telefone ?? ''),
        nota:          Number(r.nota ?? 0),
        atendimentoId: String(r.atendimento_id ?? ''),
        atendente:     String(r.atendente ?? 'Bot'),
      }))
    } catch {
      return []
    }
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
        data,
        media: Math.round((notas.reduce((s, n) => s + n, 0) / notas.length) * 10) / 10,
      }))

    return {
      media: all.length > 0 ? Math.round((soma / all.length) * 10) / 10 : 0,
      total: all.length, distribuicao: dist, tendencia,
    }
  }
}

// ── Transcrições ──────────────────────────────────────────────

export interface TranscricaoRecord {
  id:          number
  timestamp:   string
  telefone:    string
  nome:        string
  intencao:    string
  sentimento:  string
  transcricao: string
  preview:     string
}

export class TranscricoesRepository {
  constructor(private schema: string) {}

  async findAll(): Promise<TranscricaoRecord[]> {
    try {
      const rows = await query(
        `SELECT id, timestamp, telefone, nome, intencao, sentimento, transcricao, preview
         FROM ${this.schema}.transcricoes ORDER BY timestamp DESC`
      )
      return rows.map(r => ({
        id:          Number(r.id),
        timestamp:   r.timestamp ? new Date(r.timestamp as string).toISOString() : '',
        telefone:    String(r.telefone   ?? ''),
        nome:        String(r.nome       ?? ''),
        intencao:    String(r.intencao   ?? ''),
        sentimento:  String(r.sentimento ?? ''),
        transcricao: String(r.transcricao ?? ''),
        preview:     String(r.preview    ?? ''),
      }))
    } catch {
      return []
    }
  }

  async findByPhone(telefone: string): Promise<TranscricaoRecord[]> {
    try {
      const rows = await query(
        `SELECT * FROM ${this.schema}.transcricoes WHERE telefone = $1 ORDER BY timestamp DESC`,
        [telefone]
      )
      return rows.map(r => ({
        id:          Number(r.id),
        timestamp:   r.timestamp ? new Date(r.timestamp as string).toISOString() : '',
        telefone:    String(r.telefone   ?? ''),
        nome:        String(r.nome       ?? ''),
        intencao:    String(r.intencao   ?? ''),
        sentimento:  String(r.sentimento ?? ''),
        transcricao: String(r.transcricao ?? ''),
        preview:     String(r.preview    ?? ''),
      }))
    } catch {
      return []
    }
  }
}

// ── Agendamentos ──────────────────────────────────────────────

export interface AgendamentoRecord {
  id:        number
  data:      Record<string, string>
  createdAt: string
  updatedAt: string
}

export class AgendamentosRepository {
  constructor(private schema: string) {}

  async findAll(): Promise<AgendamentoRecord[]> {
    try {
      const rows = await query(
        `SELECT id, data, created_at, updated_at
         FROM ${this.schema}.agendamentos ORDER BY created_at DESC`
      )
      return rows.map(r => ({
        id:        Number(r.id),
        data:      (typeof r.data === 'string' ? JSON.parse(r.data) : r.data) as Record<string, string>,
        createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : '',
        updatedAt: r.updated_at ? new Date(r.updated_at as string).toISOString() : '',
      }))
    } catch {
      return []
    }
  }

  async create(data: Record<string, string>): Promise<AgendamentoRecord> {
    const rows = await query<{ id: number; created_at: string; updated_at: string }>(
      `INSERT INTO ${this.schema}.agendamentos (data) VALUES ($1::jsonb)
       RETURNING id, created_at, updated_at`,
      [JSON.stringify(data)]
    )
    const r = rows[0]
    return {
      id:        Number(r.id),
      data,
      createdAt: new Date(r.created_at).toISOString(),
      updatedAt: new Date(r.updated_at).toISOString(),
    }
  }
}

// ── CRM / Clientes — FASE 4 ──────────────────────────────────

export class ClientesRepository {
  constructor(private schema: string) {}

  async findAll(): Promise<ClientRecord[]> {
    try {
      const rows = await query(
        `SELECT telefone, nome, status, historico, etapa, tags,
                ultimo_contato, proximo_follow_up, valor_estimado,
                atendente, notas, origem, created_at
         FROM ${this.schema}.clientes ORDER BY nome`
      )
      return rows.map(r => ({
        telefone:        String(r.telefone ?? ''),
        nome:            String(r.nome ?? ''),
        status:          String(r.status ?? ''),
        historico:       String(r.historico ?? ''),
        etapa:           String(r.etapa ?? 'novo') as CRMStage,
        tags:            String(r.tags ?? ''),
        ultimoContato:   r.ultimo_contato   ? new Date(r.ultimo_contato   as string).toISOString() : '',
        proximoFollowUp: r.proximo_follow_up ? new Date(r.proximo_follow_up as string).toISOString() : '',
        valorEstimado:   String(r.valor_estimado ?? ''),
        atendente:       String(r.atendente ?? ''),
        notas:           String(r.notas ?? ''),
        origem:          String(r.origem ?? 'WhatsApp'),
        createdAt:       r.created_at ? new Date(r.created_at as string).toISOString() : '',
      }))
    } catch {
      return []
    }
  }

  async findByPhone(telefone: string): Promise<ClientRecord | null> {
    try {
      const rows = await query(
        `SELECT * FROM ${this.schema}.clientes WHERE telefone = $1 LIMIT 1`,
        [telefone]
      )
      if (rows.length === 0) return null
      const r = rows[0]
      return {
        telefone:        String(r.telefone ?? ''),
        nome:            String(r.nome ?? ''),
        status:          String(r.status ?? ''),
        historico:       String(r.historico ?? ''),
        etapa:           String(r.etapa ?? 'novo') as CRMStage,
        tags:            String(r.tags ?? ''),
        ultimoContato:   r.ultimo_contato   ? new Date(r.ultimo_contato   as string).toISOString() : '',
        proximoFollowUp: r.proximo_follow_up ? new Date(r.proximo_follow_up as string).toISOString() : '',
        valorEstimado:   String(r.valor_estimado ?? ''),
        atendente:       String(r.atendente ?? ''),
        notas:           String(r.notas ?? ''),
        origem:          String(r.origem ?? ''),
        createdAt:       r.created_at ? new Date(r.created_at as string).toISOString() : '',
      }
    } catch {
      return null
    }
  }

  async findByStage(etapa: CRMStage): Promise<ClientRecord[]> {
    const all = await this.findAll()
    return all.filter(c => c.etapa === etapa)
  }

  async findOverdueFollowUps(): Promise<ClientRecord[]> {
    try {
      const rows = await query(
        `SELECT * FROM ${this.schema}.clientes
         WHERE proximo_follow_up < NOW()
           AND etapa NOT IN ('fechado', 'perdido')`
      )
      return rows.map(r => ({
        telefone:        String(r.telefone ?? ''),
        nome:            String(r.nome ?? ''),
        status:          String(r.status ?? ''),
        historico:       String(r.historico ?? ''),
        etapa:           String(r.etapa ?? 'novo') as CRMStage,
        tags:            String(r.tags ?? ''),
        ultimoContato:   r.ultimo_contato    ? new Date(r.ultimo_contato    as string).toISOString() : '',
        proximoFollowUp: r.proximo_follow_up  ? new Date(r.proximo_follow_up  as string).toISOString() : '',
        valorEstimado:   String(r.valor_estimado ?? ''),
        atendente:       String(r.atendente ?? ''),
        notas:           String(r.notas ?? ''),
        origem:          String(r.origem ?? ''),
        createdAt:       r.created_at ? new Date(r.created_at as string).toISOString() : '',
      }))
    } catch {
      return []
    }
  }

  async updateClient(telefone: string, updates: Partial<ClientRecord>): Promise<void> {
    const sets: string[]  = []
    const vals: unknown[] = []
    let   idx             = 1

    if (updates.etapa           !== undefined) { sets.push(`etapa = $${idx++}`);             vals.push(updates.etapa) }
    if (updates.tags            !== undefined) { sets.push(`tags = $${idx++}`);              vals.push(updates.tags) }
    if (updates.ultimoContato   !== undefined) { sets.push(`ultimo_contato = $${idx++}`);   vals.push(updates.ultimoContato || null) }
    if (updates.proximoFollowUp !== undefined) { sets.push(`proximo_follow_up = $${idx++}`); vals.push(updates.proximoFollowUp || null) }
    if (updates.valorEstimado   !== undefined) { sets.push(`valor_estimado = $${idx++}`);   vals.push(updates.valorEstimado) }
    if (updates.atendente       !== undefined) { sets.push(`atendente = $${idx++}`);         vals.push(updates.atendente) }
    if (updates.notas           !== undefined) { sets.push(`notas = $${idx++}`);             vals.push(updates.notas) }
    if (updates.status          !== undefined) { sets.push(`status = $${idx++}`);            vals.push(updates.status) }
    if (updates.historico       !== undefined) { sets.push(`historico = $${idx++}`);         vals.push(updates.historico) }

    if (sets.length === 0) return
    sets.push(`updated_at = NOW()`)
    vals.push(telefone)
    await execute(
      `UPDATE ${this.schema}.clientes SET ${sets.join(', ')} WHERE telefone = $${idx}`,
      vals
    )
  }

  async addClient(client: ClientRecord): Promise<void> {
    await execute(
      `INSERT INTO ${this.schema}.clientes
         (telefone, nome, status, historico, etapa, tags, ultimo_contato, proximo_follow_up,
          valor_estimado, atendente, notas, origem, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (telefone) DO NOTHING`,
      [
        client.telefone, client.nome, client.status ?? '', client.historico ?? '',
        client.etapa ?? 'novo', client.tags ?? '',
        client.ultimoContato   || null,
        client.proximoFollowUp || null,
        client.valorEstimado ?? '', client.atendente ?? '', client.notas ?? '',
        client.origem ?? 'WhatsApp',
        client.createdAt || new Date().toISOString(),
      ]
    )
  }

  async getMetrics(): Promise<{
    total: number; porStatus: Record<string, number>
    porEtapa: Record<string, number>; overdueFollowUps: number; novosHoje: number
  }> {
    const all   = await this.findAll()
    const porStatus: Record<string, number> = {}
    const porEtapa:  Record<string, number> = {}
    const today = new Date().toISOString().slice(0, 10)
    const now   = new Date().toISOString()
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

// ── Primeiros Contatos ────────────────────────────────────────

export interface PrimeiroContatoRecord {
  id:        number
  telefone:  string
  parceiro:  string
  data:      string
  status:    string
  createdAt: string
}

export class PrimeirosContatosRepository {
  constructor(private schema: string) {}

  async findAll(): Promise<PrimeiroContatoRecord[]> {
    try {
      const rows = await query(
        `SELECT id, telefone, parceiro, data, status, created_at
         FROM ${this.schema}.primeiros_contatos ORDER BY data DESC`
      )
      return rows.map(r => ({
        id:        Number(r.id),
        telefone:  String(r.telefone  ?? ''),
        parceiro:  String(r.parceiro  ?? ''),
        data:      r.data       ? new Date(r.data       as string).toISOString() : '',
        status:    String(r.status    ?? 'aguardando'),
        createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : '',
      }))
    } catch {
      return []
    }
  }

  async findByPhone(telefone: string): Promise<PrimeiroContatoRecord[]> {
    try {
      const rows = await query(
        `SELECT * FROM ${this.schema}.primeiros_contatos WHERE telefone = $1 ORDER BY data DESC`,
        [telefone]
      )
      return rows.map(r => ({
        id:        Number(r.id),
        telefone:  String(r.telefone  ?? ''),
        parceiro:  String(r.parceiro  ?? ''),
        data:      r.data       ? new Date(r.data       as string).toISOString() : '',
        status:    String(r.status    ?? 'aguardando'),
        createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : '',
      }))
    } catch {
      return []
    }
  }

  async updateStatus(id: number, status: string): Promise<void> {
    await execute(
      `UPDATE ${this.schema}.primeiros_contatos SET status = $1 WHERE id = $2`,
      [status, id]
    )
  }

  async create(telefone: string, parceiro: string): Promise<PrimeiroContatoRecord> {
    const rows = await query<{ id: number; data: string; created_at: string }>(
      `INSERT INTO ${this.schema}.primeiros_contatos (telefone, parceiro)
       VALUES ($1, $2) RETURNING id, data, created_at`,
      [telefone, parceiro]
    )
    const r = rows[0]
    return {
      id:        Number(r.id),
      telefone, parceiro,
      data:      new Date(r.data).toISOString(),
      status:    'aguardando',
      createdAt: new Date(r.created_at).toISOString(),
    }
  }
}

// ── Conhecimento ──────────────────────────────────────────────

export interface ConhecimentoRecord {
  id:        number
  pergunta:  string
  resposta:  string
  categoria: string
  data:      string
  createdAt: string
  isActive:  boolean
}

export class ConhecimentoRepository {
  constructor(private schema: string) {}

  async findAll(onlyActive = true): Promise<ConhecimentoRecord[]> {
    try {
      const rows = await query(
        `SELECT id, pergunta, resposta, categoria, data, created_at, is_active
         FROM ${this.schema}.conhecimento
         ${onlyActive ? 'WHERE is_active = true' : ''}
         ORDER BY categoria, pergunta`
      )
      return rows.map(r => ({
        id:        Number(r.id),
        pergunta:  String(r.pergunta  ?? ''),
        resposta:  String(r.resposta  ?? ''),
        categoria: String(r.categoria ?? 'geral'),
        data:      r.data       ? new Date(r.data       as string).toISOString() : '',
        createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : '',
        isActive:  Boolean(r.is_active ?? true),
      }))
    } catch {
      return []
    }
  }

  async findByCategoria(categoria: string): Promise<ConhecimentoRecord[]> {
    try {
      const rows = await query(
        `SELECT * FROM ${this.schema}.conhecimento
         WHERE categoria = $1 AND is_active = true ORDER BY pergunta`,
        [categoria]
      )
      return rows.map(r => ({
        id:        Number(r.id),
        pergunta:  String(r.pergunta  ?? ''),
        resposta:  String(r.resposta  ?? ''),
        categoria: String(r.categoria ?? 'geral'),
        data:      r.data       ? new Date(r.data       as string).toISOString() : '',
        createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : '',
        isActive:  Boolean(r.is_active ?? true),
      }))
    } catch {
      return []
    }
  }

  async upsert(pergunta: string, resposta: string, categoria = 'geral'): Promise<void> {
    await execute(
      `INSERT INTO ${this.schema}.conhecimento (pergunta, resposta, categoria)
       VALUES ($1, $2, $3)
       ON CONFLICT (pergunta) DO UPDATE SET resposta = $2, categoria = $3, data = NOW()`,
      [pergunta, resposta, categoria]
    )
  }
}

// ── Instância ─────────────────────────────────────────────────

export interface InstanciaRecord {
  id:        number
  empresa:   string
  updatedAt: string
}

export class InstanciaRepository {
  constructor(private schema: string) {}

  async get(): Promise<InstanciaRecord | null> {
    try {
      const rows = await query(
        `SELECT id, empresa, updated_at FROM ${this.schema}.instancia LIMIT 1`
      )
      if (rows.length === 0) return null
      const r = rows[0]
      return {
        id:        Number(r.id),
        empresa:   String(r.empresa   ?? ''),
        updatedAt: r.updated_at ? new Date(r.updated_at as string).toISOString() : '',
      }
    } catch {
      return null
    }
  }

  async setEmpresa(empresa: string): Promise<void> {
    await execute(
      `INSERT INTO ${this.schema}.instancia (empresa)
       VALUES ($1)
       ON CONFLICT (id) DO UPDATE SET empresa = $1, updated_at = NOW()`,
      [empresa]
    )
  }
}
