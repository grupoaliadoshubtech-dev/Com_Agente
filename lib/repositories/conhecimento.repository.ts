import { query, execute } from '@/lib/supabase/client'

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

  async findAll(): Promise<ConhecimentoRecord[]> {
    try {
      const rows = await query(
        `SELECT id, pergunta, resposta, categoria, data, created_at, is_active
         FROM ${this.schema}.conhecimento
         ORDER BY created_at DESC`
      )
      return rows.map(r => this.parse(r))
    } catch { return [] }
  }

  async search(q: string, limit = 5): Promise<ConhecimentoRecord[]> {
    try {
      const term = `%${q}%`
      const rows = await query(
        `SELECT id, pergunta, resposta, categoria, data, created_at, is_active
         FROM ${this.schema}.conhecimento
         WHERE is_active = true AND (pergunta ILIKE $1 OR resposta ILIKE $1)
         ORDER BY created_at DESC
         LIMIT $2`,
        [term, limit]
      )
      return rows.map(r => this.parse(r))
    } catch { return [] }
  }

  async create(pergunta: string, resposta: string, categoria = 'geral'): Promise<ConhecimentoRecord> {
    const rows = await query(
      `INSERT INTO ${this.schema}.conhecimento (pergunta, resposta, categoria)
       VALUES ($1, $2, $3)
       ON CONFLICT (pergunta) DO UPDATE
         SET resposta = EXCLUDED.resposta, categoria = EXCLUDED.categoria, data = NOW()
       RETURNING id, pergunta, resposta, categoria, data, created_at, is_active`,
      [pergunta.trim(), resposta.trim(), categoria]
    )
    return this.parse(rows[0])
  }

  async bulkCreate(items: Array<{ pergunta: string; resposta: string; categoria?: string }>): Promise<number> {
    let count = 0
    for (const item of items) {
      try {
        await execute(
          `INSERT INTO ${this.schema}.conhecimento (pergunta, resposta, categoria)
           VALUES ($1, $2, $3)
           ON CONFLICT (pergunta) DO UPDATE
             SET resposta = EXCLUDED.resposta, categoria = EXCLUDED.categoria, data = NOW()`,
          [item.pergunta.trim(), item.resposta.trim(), item.categoria ?? 'geral']
        )
        count++
      } catch { /* ignora item inválido */ }
    }
    return count
  }

  async update(
    id: number,
    data: Partial<{ pergunta: string; resposta: string; categoria: string; isActive: boolean }>
  ): Promise<void> {
    const sets: string[] = []
    const vals: unknown[] = []
    let idx = 1
    if (data.pergunta  !== undefined) { sets.push(`pergunta = $${idx++}`);   vals.push(data.pergunta) }
    if (data.resposta  !== undefined) { sets.push(`resposta = $${idx++}`);   vals.push(data.resposta) }
    if (data.categoria !== undefined) { sets.push(`categoria = $${idx++}`);  vals.push(data.categoria) }
    if (data.isActive  !== undefined) { sets.push(`is_active = $${idx++}`);  vals.push(data.isActive) }
    if (sets.length === 0) return
    vals.push(id)
    await execute(
      `UPDATE ${this.schema}.conhecimento SET ${sets.join(', ')} WHERE id = $${idx}`,
      vals
    )
  }

  async delete(id: number): Promise<void> {
    await execute(`DELETE FROM ${this.schema}.conhecimento WHERE id = $1`, [id])
  }

  private parse(r: Record<string, unknown>): ConhecimentoRecord {
    return {
      id:        Number(r.id),
      pergunta:  String(r.pergunta  ?? ''),
      resposta:  String(r.resposta  ?? ''),
      categoria: String(r.categoria ?? 'geral'),
      data:      r.data       ? new Date(r.data       as string).toISOString() : new Date().toISOString(),
      createdAt: r.created_at ? new Date(r.created_at as string).toISOString() : new Date().toISOString(),
      isActive:  Boolean(r.is_active ?? true),
    }
  }
}
