// lib/repositories/clientes.repository.ts
// Migrado de Google Sheets → Supabase (schema do tenant)

import { query, queryOne, execute } from '@/lib/supabase/db'

export interface ClienteRecord {
  telefone: string
  nome:     string
}

export interface CRMClienteRecord {
  telefone:  string
  nome:      string
  status:    string
  historico: string
  etapa:     string
  tags:      string
}

export class ClientesRepository {
  constructor(private schema: string) {}

  async findAll(): Promise<ClienteRecord[]> {
    try {
      const rows = await query(
        `SELECT telefone, nome FROM ${this.schema}.clientes ORDER BY nome`
      )
      return rows.map(r => ({
        telefone: String(r.telefone ?? '').replace(/\D/g, ''),
        nome:     String(r.nome ?? '').trim(),
      })).filter(c => c.telefone && c.nome)
    } catch {
      return []
    }
  }

  async buildNameMap(): Promise<Map<string, string>> {
    const all = await this.findAll()
    const map = new Map<string, string>()
    for (const c of all) map.set(c.telefone, c.nome)
    return map
  }

  async findByPhone(telefone: string): Promise<CRMClienteRecord | null> {
    try {
      const row = await queryOne(
        `SELECT telefone, nome, status, historico, etapa, tags
         FROM ${this.schema}.clientes WHERE telefone = $1`,
        [telefone.replace(/\D/g, '')]
      )
      if (!row) return null
      return {
        telefone:  String(row.telefone ?? ''),
        nome:      String(row.nome ?? ''),
        status:    String(row.status ?? 'novo'),
        historico: String(row.historico ?? ''),
        etapa:     String(row.etapa ?? 'novo'),
        tags:      String(row.tags ?? ''),
      }
    } catch {
      return null
    }
  }

  async upsert(telefone: string, nome: string): Promise<void> {
    const digits = telefone.replace(/\D/g, '')
    await execute(
      `INSERT INTO ${this.schema}.clientes (telefone, nome)
       VALUES ($1, $2)
       ON CONFLICT (telefone) DO UPDATE SET nome = EXCLUDED.nome, updated_at = NOW()`,
      [digits, nome.trim()]
    )
  }

  async upsertCRM(data: {
    telefone:  string
    nome:      string
    etapa?:    string
    tags?:     string
    intencao?: string
  }): Promise<void> {
    const digits = data.telefone.replace(/\D/g, '')

    // Busca registro atual para merge de tags e etapa
    const existing = await this.findByPhone(digits)

    const novaEtapa = (() => {
      if (!existing || existing.etapa === 'novo' || existing.etapa === '') {
        return data.etapa ?? 'novo'
      }
      return existing.etapa
    })()

    const novasTags = (() => {
      if (!data.intencao) return existing?.tags ?? data.tags ?? ''
      const cur = existing?.tags ?? ''
      if (cur.toLowerCase().includes(data.intencao)) return cur
      return cur ? `${cur},${data.intencao}` : data.intencao
    })()

    await execute(
      `INSERT INTO ${this.schema}.clientes (telefone, nome, etapa, tags, ultimo_contato, origem)
       VALUES ($1, $2, $3, $4, NOW(), 'WhatsApp')
       ON CONFLICT (telefone) DO UPDATE SET
         nome          = EXCLUDED.nome,
         etapa         = $3,
         tags          = $4,
         ultimo_contato = NOW(),
         updated_at    = NOW()`,
      [digits, data.nome.trim(), novaEtapa, novasTags]
    )
  }
}
