// ─────────────────────────────────────────────────────────────
// lib/repositories/users.repository.ts
//
// Fonte de verdade: aba "Usuarios" de CADA planilha de tenant.
//
// Colunas esperadas (linha 1 = cabeçalho):
//   A: id | B: tenantId | C: email | D: passwordHash | E: name
//   F: role | G: phone | H: canViewDashboard | I: canViewCRM
//   J: canViewTranscricoes | K: canViewSatisfacao
//   L: createdAt | M: isActive
// ─────────────────────────────────────────────────────────────

import { readRange, updateRange, appendRows, rowsToObjects } from '@/lib/sheets/client'
import type { UserRecord } from '@/types'

const SHEET   = 'Usuarios'
const RANGE   = `${SHEET}!A:M`
const MASTER_ID = process.env.GOOGLE_MASTER_SHEET_ID!

// ── Helpers internos ─────────────────────────────────────────

function parseUser(raw: Record<string, string>): UserRecord {
  return {
    id:                    raw.id,
    tenantId:              raw.tenantId,
    email:                 raw.email.toLowerCase().trim(),
    passwordHash:          raw.passwordHash,
    name:                  raw.name,
    role:                  raw.role as UserRecord['role'],
    phone:                 raw.phone ?? '',
    canViewDashboard:      raw.canViewDashboard === 'TRUE',
    canViewCRM:            raw.canViewCRM === 'TRUE',
    canViewTranscricoes:   raw.canViewTranscricoes === 'TRUE',
    canViewSatisfacao:     raw.canViewSatisfacao === 'TRUE',
    createdAt:             raw.createdAt,
    isActive:              raw.isActive !== 'FALSE',
  }
}

function userToRow(u: UserRecord): (string | boolean)[] {
  return [
    u.id,
    u.tenantId,
    u.email,
    u.passwordHash,
    u.name,
    u.role,
    u.phone ?? '',
    u.canViewDashboard,
    u.canViewCRM,
    u.canViewTranscricoes,
    u.canViewSatisfacao,
    u.createdAt,
    u.isActive,
  ]
}

// ── Repositório ───────────────────────────────────────────────

export class UsersRepository {
  constructor(private spreadsheetId: string = MASTER_ID) {}

  /** Busca todos os usuários ativos da planilha. */
  async findAll(): Promise<UserRecord[]> {
    const rows = await readRange(this.spreadsheetId, RANGE)
    return rowsToObjects<Record<string, string>>(rows)
      .map(parseUser)
      .filter(u => u.isActive)
  }

  /** Busca usuário por e-mail (case-insensitive). */
  async findByEmail(email: string): Promise<UserRecord | null> {
    const all = await this.findAll()
    return all.find(u => u.email === email.toLowerCase().trim()) ?? null
  }

  /** Busca usuário por ID. */
  async findById(id: string): Promise<UserRecord | null> {
    const all = await this.findAll()
    return all.find(u => u.id === id) ?? null
  }

  /** Cria novo usuário (append no Sheets). */
  async create(user: UserRecord): Promise<void> {
    await appendRows(this.spreadsheetId, RANGE, [userToRow(user)])
  }

  /**
   * Atualiza toggles de permissão de um atendente.
   * Encontra a linha pelo ID e faz update cirúrgico nas colunas H-K.
   */
  async updateToggles(
    userId: string,
    toggles: Pick<
      UserRecord,
      'canViewDashboard' | 'canViewCRM' | 'canViewTranscricoes' | 'canViewSatisfacao'
    >
  ): Promise<void> {
    const rows = await readRange(this.spreadsheetId, RANGE)
    if (rows.length < 2) return

    const headers = rows[0]
    const idCol   = headers.indexOf('id')

    const rowIndex = rows.findIndex((r, i) => i > 0 && r[idCol] === userId)
    if (rowIndex === -1) throw new Error(`Usuário ${userId} não encontrado.`)

    // Sheets rows são 1-indexed, +1 para pular cabeçalho
    const sheetRow = rowIndex + 1

    await updateRange(
      this.spreadsheetId,
      `${SHEET}!H${sheetRow}:K${sheetRow}`,
      [[
        toggles.canViewDashboard,
        toggles.canViewCRM,
        toggles.canViewTranscricoes,
        toggles.canViewSatisfacao,
      ]]
    )
  }

  /** Desativa usuário (soft delete — coluna M = FALSE). */
  async deactivate(userId: string): Promise<void> {
    const rows = await readRange(this.spreadsheetId, RANGE)
    if (rows.length < 2) return

    const headers  = rows[0]
    const idCol    = headers.indexOf('id')
    const rowIndex = rows.findIndex((r, i) => i > 0 && r[idCol] === userId)
    if (rowIndex === -1) return

    const sheetRow = rowIndex + 1
    await updateRange(this.spreadsheetId, `${SHEET}!M${sheetRow}`, [['FALSE']])
  }
}
