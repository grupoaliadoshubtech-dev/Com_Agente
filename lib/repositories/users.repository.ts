// ─────────────────────────────────────────────────────────────
// lib/repositories/users.repository.ts
//
// Fonte de verdade: aba "Usuarios" da planilha MASTER.
// Todos os usuários (master, supervisor, atendente) ficam aqui.
// Isolamento por tenant via campo tenantId (shared schema).
//
// Colunas esperadas (linha 1 = cabeçalho):
//   A: id | B: tenantId | C: email | D: passwordHash | E: name
//   F: role | G: phone | H: canViewDashboard | I: canViewCRM
//   J: canViewTranscricoes | K: canViewSatisfacao
//   L: createdAt | M: isActive | N: avatarUrl | O: mustChangePassword
// ─────────────────────────────────────────────────────────────

import { readRange, updateRange, smartAppend, rowsToObjects } from '@/lib/sheets/client'
import type { UserRecord } from '@/types'

const SHEET   = 'Usuarios'
const RANGE   = `${SHEET}!A:O`
const MASTER_ID = process.env.GOOGLE_MASTER_SHEET_ID!

// ── Helpers internos ─────────────────────────────────────────

function parseUser(raw: Record<string, string>): UserRecord {
  return {
    id:                    raw.id   ?? '',
    tenantId:              raw.tenantId ?? '',
    email:                 (raw.email ?? '').toLowerCase().trim(),
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
    avatarUrl:             raw.avatarUrl ?? '',
    mustChangePassword:    raw.mustChangePassword === 'TRUE',
  }
}

function userToRow(u: UserRecord): (string | boolean)[] {
  return [
    u.id,                  // A
    u.tenantId,            // B
    u.email,               // C
    u.passwordHash,        // D
    u.name,                // E
    u.role,                // F
    u.phone ?? '',         // G
    u.canViewDashboard,    // H
    u.canViewCRM,          // I
    u.canViewTranscricoes, // J
    u.canViewSatisfacao,   // K
    u.createdAt,                    // L
    u.isActive,                    // M
    u.avatarUrl ?? '',             // N
    u.mustChangePassword ?? false, // O
  ]
}

// ── Repositório ───────────────────────────────────────────────

export class UsersRepository {
  constructor(private spreadsheetId: string = MASTER_ID) {}

  /** Busca todos os usuários ativos da planilha. */
  async findAll(): Promise<UserRecord[]> {
    const rows = await readRange(this.spreadsheetId, RANGE)
    return rowsToObjects<Record<string, string>>(rows)
      .filter(r => r.id && r.email)
      .map(parseUser)
      .filter(u => u.isActive)
  }

  /** Busca todos os usuários ativos de um tenant (filtra por tenantId). */
  async findByTenantId(tenantId: string): Promise<UserRecord[]> {
    const all = await this.findAll()
    return all.filter(u => u.tenantId === tenantId)
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

  /** Cria novo usuário logo após a última linha com id real, ignorando linhas com checkboxes. */
  async create(user: UserRecord): Promise<void> {
    await smartAppend(this.spreadsheetId, SHEET, [userToRow(user)])
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

  /** Redefine o passwordHash de um usuário pelo e-mail. */
  async resetPassword(email: string, newHash: string): Promise<boolean> {
    const rows = await readRange(this.spreadsheetId, RANGE)
    if (rows.length < 2) return false

    const headers  = rows[0]
    const emailCol = headers.indexOf('email')
    const hashCol  = headers.indexOf('passwordHash')

    const rowIndex = rows.findIndex((r, i) => i > 0 && r[emailCol]?.toLowerCase().trim() === email.toLowerCase().trim())
    if (rowIndex === -1) return false

    const sheetRow = rowIndex + 1
    const colLetter = String.fromCharCode(65 + hashCol) // D
    await updateRange(this.spreadsheetId, `${SHEET}!${colLetter}${sheetRow}`, [[newHash]])
    return true
  }

  /** Atualiza nome, passwordHash, avatarUrl e/ou mustChangePassword do usuário. */
  async updateProfile(
    userId: string,
    data: { name?: string; passwordHash?: string; avatarUrl?: string; mustChangePassword?: boolean }
  ): Promise<boolean> {
    const rows = await readRange(this.spreadsheetId, RANGE)
    if (rows.length < 2) return false

    const headers  = rows[0]
    const idCol    = headers.indexOf('id')
    const rowIndex = rows.findIndex((r, i) => i > 0 && r[idCol] === userId)
    if (rowIndex === -1) return false

    const sheetRow = rowIndex + 1
    const updates: Promise<void>[] = []

    if (data.name !== undefined) {
      const col = headers.indexOf('name')
      if (col !== -1) updates.push(updateRange(this.spreadsheetId, `${SHEET}!${String.fromCharCode(65 + col)}${sheetRow}`, [[data.name]]))
    }
    if (data.passwordHash !== undefined) {
      const col = headers.indexOf('passwordHash')
      if (col !== -1) updates.push(updateRange(this.spreadsheetId, `${SHEET}!${String.fromCharCode(65 + col)}${sheetRow}`, [[data.passwordHash]]))
    }
    if (data.avatarUrl !== undefined) {
      const col = headers.indexOf('avatarUrl')
      if (col !== -1) updates.push(updateRange(this.spreadsheetId, `${SHEET}!${String.fromCharCode(65 + col)}${sheetRow}`, [[data.avatarUrl]]))
    }
    if (data.mustChangePassword !== undefined) {
      const col = headers.indexOf('mustChangePassword')
      if (col !== -1) updates.push(updateRange(this.spreadsheetId, `${SHEET}!${String.fromCharCode(65 + col)}${sheetRow}`, [[data.mustChangePassword]]))
    }

    await Promise.all(updates)
    return true
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
