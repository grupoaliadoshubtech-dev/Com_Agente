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

import { appendRows, readRange, deleteRows, getSheetId } from '@/lib/sheets/client'
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
   * Retoma IA — apaga todas as linhas do telefone na Fila_Humana.
   * getStatus() checa presença na coluna A: sem linha = ativo.
   */
  async retomar(telefone: string): Promise<void> {
    console.log('[retomar] spreadsheetId:', this.spreadsheetId, 'telefone:', telefone)
    const colA = await readRange(this.spreadsheetId, `${SHEET}!A:A`)
    console.log('[retomar] colA length:', colA.length, 'valores:', colA.slice(0,10).map(r => r[0]))
    const indices: number[] = []
    for (let i = 1; i < colA.length; i++) {
      const val = (colA[i]?.[0] ?? '').trim()
      if (val === telefone) indices.push(i)
    }
    console.log('[retomar] indices encontrados:', indices)
    if (indices.length === 0) {
      console.warn('[retomar] nenhuma linha encontrada para telefone:', telefone)
      return
    }
    const sheetId = await getSheetId(this.spreadsheetId, SHEET)
    console.log('[retomar] sheetId:', sheetId)
    await deleteRows(this.spreadsheetId, sheetId, indices)
    console.log('[retomar] linhas deletadas com sucesso')
  }

  /**
   * Verifica se IA está pausada: lê coluna A a partir da linha 2.
   * Se o número (ou 'ALL') existir → pausado. Se não existir → ativo.
   */
  async getStatus(telefone: string): Promise<'pausado' | 'ativo'> {
    const colA = await readRange(this.spreadsheetId, `${SHEET}!A2:A`)
    const phones = colA.flat().map(v => v.trim()).filter(Boolean)
    if (phones.includes('ALL') || phones.includes(telefone)) return 'pausado'
    return 'ativo'
  }

  /**
   * Retorna toda a fila atual — leitura posicional a partir da linha 2.
   */
  async getAll(): Promise<HandoffRecord[]> {
    const rows = await readRange(this.spreadsheetId, `${SHEET}!A2:D`)
    return rows
      .filter(r => (r[0] ?? '').trim())
      .map(r => ({
        telefone:  r[0].trim(),
        status:    'pausado' as HandoffRecord['status'],
        timestamp: r[2] ?? '',
        atendente: r[3] ?? '',
      }))
  }
}
