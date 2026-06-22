// ─────────────────────────────────────────────────────────────
// lib/repositories/clientes.repository.ts
//
// Aba "Clientes" da planilha do tenant.
// Colunas mínimas: A=telefone | B=nome
// (colunas extras são ignoradas com segurança)
// ─────────────────────────────────────────────────────────────

import { readRange } from '@/lib/sheets/client'

const SHEET = 'Clientes'

export interface ClienteRecord {
  telefone: string
  nome:     string
}

export class ClientesRepository {
  constructor(private spreadsheetId: string) {}

  /** Retorna todos os clientes da planilha. */
  async findAll(): Promise<ClienteRecord[]> {
    const rows = await readRange(this.spreadsheetId, `${SHEET}!A:B`)
    if (rows.length < 2) return []

    const [header, ...data] = rows
    const colTelefone = header.findIndex(h => h.toLowerCase().includes('telefone'))
    const colNome     = header.findIndex(h => h.toLowerCase().includes('nome'))

    if (colTelefone === -1 || colNome === -1) return []

    return data
      .map(row => ({
        telefone: normalizePhone(row[colTelefone] ?? ''),
        nome:     (row[colNome] ?? '').trim(),
      }))
      .filter(c => c.telefone && c.nome)
  }

  /** Retorna um Map<telefoneNormalizado, nome> para lookup O(1). */
  async buildNameMap(): Promise<Map<string, string>> {
    const all = await this.findAll()
    const map = new Map<string, string>()
    for (const c of all) map.set(c.telefone, c.nome)
    return map
  }
}

/** Remove qualquer caractere não-dígito e prefixos de país duplicados. */
function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, '')
}
