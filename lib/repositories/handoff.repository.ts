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

import { appendRows, readRange, rowsToObjects } from '@/lib/sheets/client'
import type { HandoffRecord } from '@/types'

const SHEET = 'Fila_Humana'
const RANGE = `${SHEET}!A:D`

export class HandoffRepository {
  constructor(private spreadsheetId: string) {}

  /**
   * Pausa IA para um cliente específico.
   * Grava: telefone | "pausado" | ISO timestamp | atendenteId
   */
  async pausar(telefone: string, atendenteId: string): Promise<void> {
    const now = new Date()
    const brTimestamp = now.toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).replace(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}:\d{2}:\d{2})/, '$3-$2-$1 $4')
    const record: (string)[] = [
      telefone,
      'pausado',
      brTimestamp,
      atendenteId,
    ]
    await appendRows(this.spreadsheetId, RANGE, [record])
  }

  /**
   * Pausa Global — pausa IA para TODOS.
   * Grava "ALL" na coluna Telefone. O n8n detecta "ALL" e
   * bloqueia processamento de qualquer número.
   */
  async pausaGlobal(atendenteId: string): Promise<void> {
    await this.pausar('ALL', atendenteId)
  }

  /**
   * Retoma IA — grava linha com Status='ativo', mesma lógica do Retornar Global.
   * getStatus() lê o registro mais recente, então 'ativo' sobrescreve qualquer 'pausado' anterior.
   */
  async retomar(telefone: string, atendenteId = 'sistema'): Promise<void> {
    await appendRows(this.spreadsheetId, RANGE, [[
      telefone,
      'ativo',
      new Date().toLocaleString('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false,
      }).replace(/(\d{2})\/(\d{2})\/(\d{4}), (\d{2}:\d{2}:\d{2})/, '$3-$2-$1 $4'),
      atendenteId,
    ]])
  }

  /**
   * Verifica se IA está pausada para um número.
   * Leitura posicional: A=telefone, B=status, C=timestamp — imune a variação nos cabeçalhos.
   */
  async getStatus(telefone: string): Promise<'pausado' | 'ativo'> {
    const rows = await readRange(this.spreadsheetId, RANGE)
    if (rows.length < 2) return 'ativo'

    const toMs = (ts: string) => { try { return new Date(ts.replace(' ', 'T')).getTime() } catch { return 0 } }

    const relevant = rows.slice(1).filter(r => {
      const tel = (r[0] ?? '').trim()
      return tel === telefone || tel === 'ALL'
    })

    if (relevant.length === 0) return 'ativo'

    const sorted = [...relevant].sort((a, b) => toMs(b[2] ?? '') - toMs(a[2] ?? ''))
    return (sorted[0][1] ?? '').trim() === 'pausado' ? 'pausado' : 'ativo'
  }

  /**
   * Retorna toda a fila atual.
   * Leitura posicional: A=telefone, B=status, C=timestamp, D=atendente.
   */
  async getAll(): Promise<HandoffRecord[]> {
    const rows = await readRange(this.spreadsheetId, RANGE)
    if (rows.length < 2) return []
    return rows.slice(1).map(r => ({
      telefone:  (r[0] ?? '').trim(),
      status:    ((r[1] ?? 'ativo').trim()) as HandoffRecord['status'],
      timestamp: r[2] ?? '',
      atendente: r[3] ?? '',
    })).filter(r => r.telefone)
  }
}
