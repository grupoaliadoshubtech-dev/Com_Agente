// ─────────────────────────────────────────────────────────────
// lib/repositories/reset-token.repository.ts
//
// Armazena tokens de redefinição de senha na aba
// "ResetTokens" da planilha MASTER.
//
// Colunas: token | userId | email | expiresAt | usedAt
//
// TTL: 1 hora. Token é marcado como usado após redefinição.
// ─────────────────────────────────────────────────────────────

import { readRange, appendRows, updateRange, rowsToObjects } from '@/lib/sheets/client'
import crypto from 'crypto'

const MASTER_ID = process.env.GOOGLE_MASTER_SHEET_ID!
const SHEET     = 'ResetTokens'
const RANGE     = `${SHEET}!A:E`
const TTL_MS    = 60 * 60 * 1000  // 1 hora

export interface ResetTokenRecord {
  token:     string
  userId:    string
  email:     string
  expiresAt: string   // ISO 8601
  usedAt:    string   // ISO 8601 | "" se não usado
}

export class ResetTokenRepository {
  /** Gera e persiste novo token. Retorna o token gerado. */
  async create(userId: string, email: string): Promise<string> {
    // Invalida tokens anteriores do mesmo usuário
    await this.invalidateByUserId(userId)

    const token     = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + TTL_MS).toISOString()

    await appendRows(MASTER_ID, RANGE, [[
      token, userId, email.toLowerCase().trim(), expiresAt, '',
    ]])

    return token
  }

  /** Verifica se o token é válido (existe, não expirado, não usado). */
  async verify(token: string): Promise<ResetTokenRecord | null> {
    const rows    = await readRange(MASTER_ID, RANGE)
    const records = rowsToObjects<Record<string, string>>(rows)

    const found = records.find(r => r.token === token)
    if (!found) return null

    const record: ResetTokenRecord = {
      token:     found.token,
      userId:    found.userId,
      email:     found.email,
      expiresAt: found.expiresAt,
      usedAt:    found.usedAt ?? '',
    }

    // Já usado
    if (record.usedAt) return null

    // Expirado
    if (new Date(record.expiresAt).getTime() < Date.now()) return null

    return record
  }

  /** Marca token como usado (não permite reuso). */
  async consume(token: string): Promise<void> {
    const rows = await readRange(MASTER_ID, RANGE)
    if (rows.length < 2) return

    const headers  = rows[0]
    const tokenCol = headers.indexOf('token')
    const usedCol  = headers.indexOf('usedAt')

    const rowIndex = rows.findIndex((r, i) => i > 0 && r[tokenCol] === token)
    if (rowIndex === -1) return

    const sheetRow  = rowIndex + 1
    const colLetter = String.fromCharCode(65 + usedCol)  // A=0, E=4 → "E"

    await updateRange(
      MASTER_ID,
      `${SHEET}!${colLetter}${sheetRow}`,
      [[new Date().toISOString()]]
    )
  }

  /** Invalida todos os tokens ativos de um usuário. */
  private async invalidateByUserId(userId: string): Promise<void> {
    const rows = await readRange(MASTER_ID, RANGE)
    if (rows.length < 2) return

    const headers     = rows[0]
    const userIdCol   = headers.indexOf('userId')
    const usedAtCol   = headers.indexOf('usedAt')
    const expiresCol  = headers.indexOf('expiresAt')
    const colLetter   = String.fromCharCode(65 + usedAtCol)

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      if (row[userIdCol] !== userId) continue
      if (row[usedAtCol])           continue  // já usado
      // Expira imediatamente
      const sheetRow = i + 1
      await updateRange(MASTER_ID, `${SHEET}!${colLetter}${sheetRow}`, [['invalidated']])
    }
  }
}
