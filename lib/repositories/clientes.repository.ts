// lib/repositories/clientes.repository.ts
// Migrado de Google Sheets → Supabase (schema do tenant)

import { query, execute } from '@/lib/supabase/db'

export interface ClienteRecord {
  telefone: string
  nome:     string
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

  async upsert(telefone: string, nome: string): Promise<void> {
    const digits = telefone.replace(/\D/g, '')
    await execute(
      `INSERT INTO ${this.schema}.clientes (telefone, nome)
       VALUES ($1, $2)
       ON CONFLICT (telefone) DO UPDATE SET nome = EXCLUDED.nome, updated_at = NOW()`,
      [digits, nome.trim()]
    )
  }
}
