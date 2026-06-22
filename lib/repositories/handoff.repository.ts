// ─────────────────────────────────────────────────────────────
// lib/repositories/handoff.repository.ts
//
// REGRA CENTRAL DO SISTEMA:
// Toda pausa de IA grava na aba "Fila_Humana" da planilha do tenant
// com exatamente 4 colunas:
//   A: Telefone  (número OU "ALL" para kill switch)
//   B: Status    ("pausado" ou "ativo")
//   C: Timestamp (ISO 8601)
//   D: Atendente (ID do usuário logado)
// ─────────────────────────────────────────────────────────────

import { appendRows, readRange, deleteRows, rowsToObjects } from '@/lib/sheets/client'
import type { HandoffRecord } from '@/types'

const SHEET    = 'Fila_Humana'
const RANGE    = `${SHEET}!A:D`
const SHEET_ID = 1239974346  // gid da aba Fila_Humana

export class HandoffRepository {
  constructor(private spreadsheetId: string) {}

  /**
   * Pausa IA para um cliente específico.
   * Grava: telefone | "pausado" | ISO timestamp | atendenteId
   */
  async pausar(telefone: string, atendenteId: string): Promise<void> {
    const record: (string)[] = [
      telefone,
      'pausado',
      new Date().toISOString(),
      atendenteId,
    ]
    await appendRows(this.spreadsheetId, RANGE, [record])
  }

  /**
   * Kill Switch Global — pausa IA para TODOS.
   * Grava "ALL" na coluna Telefone. O n8n detecta "ALL" e
   * bloqueia processamento de qualquer número.
   */
  async killSwitch(atendenteId: string): Promise<void> {
    await this.pausar('ALL', atendenteId)
  }

  /**
   * Retoma IA para um cliente — apaga todas as linhas do telefone na fila.
   * getStatus() sem registros retorna 'ativo' por padrão, então não precisa gravar nada.
   */
  async retomar(telefone: string): Promise<void> {
    const rows = await readRange(this.spreadsheetId, RANGE)
    if (rows.length < 2) return

    // linha 0 = header (índice 0 na planilha), dados começam na linha 1
    const indices: number[] = []
    for (let i = 1; i < rows.length; i++) {
      if ((rows[i][0] ?? '').trim() === telefone) indices.push(i)
    }

    await deleteRows(this.spreadsheetId, SHEET_ID, indices)
  }

  /**
   * Verifica se IA está pausada para um número.
   * Lê a fila e retorna o status mais recente daquele telefone.
   */
  async getStatus(telefone: string): Promise<'pausado' | 'ativo'> {
    const rows = await readRange(this.spreadsheetId, RANGE)
    const records = rowsToObjects<Record<string, string>>(rows)

    // Filtra registros do telefone OU ALL (kill switch ativo afeta todos)
    const relevant = records.filter(
      r => r.Telefone === telefone || r.Telefone === 'ALL'
    )

    if (relevant.length === 0) return 'ativo'

    // O mais recente determina o status
    const sorted = relevant.sort(
      (a, b) =>
        new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime()
    )

    return sorted[0].Status === 'pausado' ? 'pausado' : 'ativo'
  }

  /**
   * Retorna toda a fila atual (últimos 100 registros).
   */
  async getAll(): Promise<HandoffRecord[]> {
    const rows = await readRange(this.spreadsheetId, `${SHEET}!A:D`)
    return rowsToObjects<Record<string, string>>(rows).map(r => ({
      telefone:  r.Telefone ?? r.A ?? '',
      status:    (r.Status ?? r.B ?? 'ativo') as HandoffRecord['status'],
      timestamp: r.Timestamp ?? r.C ?? '',
      atendente: r.Atendente ?? r.D ?? '',
    }))
  }
}
