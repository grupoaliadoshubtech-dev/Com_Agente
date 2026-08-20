// lib/repositories/distribution.repository.ts
// Migrado de Google Sheets → Supabase (schema do tenant)

import { query, execute } from '@/lib/supabase/db'
import { UsersRepository } from './users.repository'
import { randomUUID } from 'crypto'

export interface DistributionRecord {
  atendenteId:      string
  atendenteNome:    string
  atendentePhone:   string
  online:           boolean
  especialidade:    string
  maxConversas:     number
  conversasAtivas:  number
  ultimaAtribuicao: string
  totalAtribuidos:  number
}

export interface AtribuicaoLog {
  id:              string
  telefoneCliente: string
  atendenteId:     string
  atendenteNome:   string
  timestamp:       string
  motivo:          string
}

function parse(row: Record<string, unknown>): DistributionRecord {
  return {
    atendenteId:      String(row.atendente_id ?? ''),
    atendenteNome:    String(row.atendente_nome ?? ''),
    atendentePhone:   String(row.atendente_phone ?? ''),
    online:           Boolean(row.online),
    especialidade:    String(row.especialidade ?? 'geral'),
    maxConversas:     Number(row.max_conversas ?? 5),
    conversasAtivas:  Number(row.conversas_ativas ?? 0),
    ultimaAtribuicao: row.ultima_atribuicao ? new Date(row.ultima_atribuicao as string).toISOString() : '',
    totalAtribuidos:  Number(row.total_atribuidos ?? 0),
  }
}

export class DistributionRepository {
  constructor(private schema: string) {}

  async findAll(): Promise<DistributionRecord[]> {
    try {
      const rows = await query(`SELECT * FROM ${this.schema}.distribuicao ORDER BY atendente_nome`)
      return rows.map(parse)
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

  async getNextAttendant(especialidade?: string): Promise<DistributionRecord | null> {
    const available = await this.findAvailable(especialidade)
    if (available.length === 0) return null
    available.sort((a, b) => {
      if (a.conversasAtivas !== b.conversasAtivas) return a.conversasAtivas - b.conversasAtivas
      const tA = a.ultimaAtribuicao ? new Date(a.ultimaAtribuicao).getTime() : 0
      const tB = b.ultimaAtribuicao ? new Date(b.ultimaAtribuicao).getTime() : 0
      return tA - tB
    })
    return available[0]
  }

  async atribuir(atendenteId: string, telefoneCliente: string, motivo = 'round-robin'): Promise<void> {
    const rows = await query(
      `SELECT atendente_nome, conversas_ativas, total_atribuidos
       FROM ${this.schema}.distribuicao WHERE atendente_id = $1`,
      [atendenteId]
    )
    if (rows.length === 0) return

    const nome = String(rows[0].atendente_nome ?? '')
    await execute(
      `UPDATE ${this.schema}.distribuicao
       SET conversas_ativas  = conversas_ativas + 1,
           total_atribuidos  = total_atribuidos + 1,
           ultima_atribuicao = NOW()
       WHERE atendente_id = $1`,
      [atendenteId]
    )
    await this.logAtribuicao(telefoneCliente, atendenteId, nome, motivo)
  }

  async liberar(atendenteId: string): Promise<void> {
    await execute(
      `UPDATE ${this.schema}.distribuicao
       SET conversas_ativas = GREATEST(0, conversas_ativas - 1)
       WHERE atendente_id = $1`,
      [atendenteId]
    )
  }

  async setOnline(atendenteId: string, online: boolean): Promise<void> {
    await execute(
      `UPDATE ${this.schema}.distribuicao
       SET online = $1,
           conversas_ativas = CASE WHEN $1 = false THEN 0 ELSE conversas_ativas END
       WHERE atendente_id = $2`,
      [online, atendenteId]
    )
  }

  async updateConfig(atendenteId: string, updates: { especialidade?: string; maxConversas?: number }): Promise<void> {
    const sets: string[]  = []
    const vals: unknown[] = []
    let   idx             = 1

    if (updates.especialidade !== undefined) { sets.push(`especialidade = $${idx++}`);  vals.push(updates.especialidade) }
    if (updates.maxConversas  !== undefined) { sets.push(`max_conversas = $${idx++}`);  vals.push(updates.maxConversas) }

    if (sets.length === 0) return
    vals.push(atendenteId)
    await execute(`UPDATE ${this.schema}.distribuicao SET ${sets.join(', ')} WHERE atendente_id = $${idx}`, vals)
  }

  async syncFromUsers(): Promise<void> {
    const usersRepo = new UsersRepository()
    const users     = await usersRepo.findAll()
    const attendants = users.filter(u => u.role === 'atendente' || u.role === 'supervisor')
    const existing   = await this.findAll()
    const existingIds = new Set(existing.map(e => e.atendenteId))

    for (const user of attendants) {
      if (existingIds.has(user.id)) continue
      await execute(
        `INSERT INTO ${this.schema}.distribuicao
           (atendente_id, atendente_nome, atendente_phone, online, especialidade, max_conversas, conversas_ativas, total_atribuidos)
         VALUES ($1, $2, $3, false, 'geral', 5, 0, 0)
         ON CONFLICT (atendente_id) DO NOTHING`,
        [user.id, user.name, user.phone ?? '']
      )
    }
  }

  private async logAtribuicao(telefoneCliente: string, atendenteId: string, atendenteNome: string, motivo: string): Promise<void> {
    try {
      await execute(
        `INSERT INTO ${this.schema}.log_distribuicao (id, telefone_cliente, atendente_id, atendente_nome, timestamp, motivo)
         VALUES ($1, $2, $3, $4, NOW(), $5)`,
        [randomUUID(), telefoneCliente, atendenteId, atendenteNome, motivo]
      )
    } catch {
      console.error('[Distribution] Erro ao gravar log')
    }
  }

  async getMetrics(): Promise<{
    totalOnline:          number
    totalOffline:         number
    totalConversasAtivas: number
    capacidadeTotal:      number
    capacidadeUsada:      number
    atendentes:           DistributionRecord[]
  }> {
    const all     = await this.findAll()
    const online  = all.filter(a => a.online)
    const totalConversas = all.reduce((s, a) => s + a.conversasAtivas, 0)
    const capacidade     = online.reduce((s, a) => s + a.maxConversas, 0)

    return {
      totalOnline:          online.length,
      totalOffline:         all.length - online.length,
      totalConversasAtivas: totalConversas,
      capacidadeTotal:      capacidade,
      capacidadeUsada:      capacidade > 0 ? Math.round((totalConversas / capacidade) * 100) : 0,
      atendentes:           all,
    }
  }
}
