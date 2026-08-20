// lib/repositories/users.repository.ts
// Migrado de Google Sheets → Supabase (schema: app)

import { query, queryOne, execute } from '@/lib/supabase/db'
import type { UserRecord } from '@/types'

function parse(row: Record<string, unknown>): UserRecord {
  return {
    id:                  String(row.id),
    tenantId:            String(row.tenant_id),
    email:               String(row.email ?? '').toLowerCase().trim(),
    passwordHash:        String(row.password_hash ?? ''),
    name:                String(row.name ?? ''),
    role:                String(row.role ?? 'atendente') as UserRecord['role'],
    phone:               String(row.phone ?? ''),
    canViewDashboard:    Boolean(row.can_view_dashboard),
    canViewCRM:          Boolean(row.can_view_crm),
    canViewTranscricoes: Boolean(row.can_view_transcricoes),
    canViewSatisfacao:   Boolean(row.can_view_satisfacao),
    canViewAgendamentos: Boolean(row.can_view_agendamentos),
    createdAt:           row.created_at ? new Date(row.created_at as string).toISOString() : '',
    isActive:            Boolean(row.is_active),
    avatarUrl:           String(row.avatar_url ?? ''),
    mustChangePassword:  Boolean(row.must_change_password),
  }
}

export class UsersRepository {
  async findAll(): Promise<UserRecord[]> {
    const rows = await query('SELECT * FROM app.usuarios WHERE is_active = true ORDER BY name')
    return rows.map(parse)
  }

  async findByTenantId(tenantId: string): Promise<UserRecord[]> {
    const rows = await query(
      'SELECT * FROM app.usuarios WHERE tenant_id = $1 AND is_active = true ORDER BY name',
      [tenantId]
    )
    return rows.map(parse)
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const row = await queryOne(
      'SELECT * FROM app.usuarios WHERE email = $1 AND is_active = true',
      [email.toLowerCase().trim()]
    )
    return row ? parse(row) : null
  }

  async findById(id: string): Promise<UserRecord | null> {
    const row = await queryOne(
      'SELECT * FROM app.usuarios WHERE id = $1',
      [id]
    )
    return row ? parse(row) : null
  }

  async create(user: UserRecord): Promise<void> {
    await execute(
      `INSERT INTO app.usuarios
         (id, tenant_id, email, password_hash, name, role, phone,
          can_view_dashboard, can_view_crm, can_view_transcricoes,
          can_view_satisfacao, can_view_agendamentos,
          created_at, is_active, avatar_url, must_change_password)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
      [
        user.id, user.tenantId, user.email, user.passwordHash,
        user.name, user.role, user.phone ?? '',
        user.canViewDashboard, user.canViewCRM, user.canViewTranscricoes,
        user.canViewSatisfacao, user.canViewAgendamentos ?? false,
        user.createdAt, user.isActive,
        user.avatarUrl ?? '', user.mustChangePassword ?? false,
      ]
    )
  }

  async updateToggles(
    userId: string,
    toggles: Pick<UserRecord, 'canViewDashboard' | 'canViewCRM' | 'canViewTranscricoes' | 'canViewSatisfacao' | 'canViewAgendamentos'>
  ): Promise<void> {
    await execute(
      `UPDATE app.usuarios SET
         can_view_dashboard    = $1,
         can_view_crm          = $2,
         can_view_transcricoes = $3,
         can_view_satisfacao   = $4,
         can_view_agendamentos = $5
       WHERE id = $6`,
      [
        toggles.canViewDashboard, toggles.canViewCRM,
        toggles.canViewTranscricoes, toggles.canViewSatisfacao,
        toggles.canViewAgendamentos, userId,
      ]
    )
  }

  async resetPassword(email: string, newHash: string): Promise<boolean> {
    const rows = await query<{ id: string }>(
      'UPDATE app.usuarios SET password_hash = $1 WHERE email = $2 RETURNING id',
      [newHash, email.toLowerCase().trim()]
    )
    return rows.length > 0
  }

  async updateProfile(
    userId: string,
    data: { name?: string; passwordHash?: string; avatarUrl?: string; mustChangePassword?: boolean }
  ): Promise<boolean> {
    const sets: string[]  = []
    const vals: unknown[] = []
    let   idx             = 1

    if (data.name              !== undefined) { sets.push(`name = $${idx++}`);               vals.push(data.name) }
    if (data.passwordHash      !== undefined) { sets.push(`password_hash = $${idx++}`);      vals.push(data.passwordHash) }
    if (data.avatarUrl         !== undefined) { sets.push(`avatar_url = $${idx++}`);         vals.push(data.avatarUrl) }
    if (data.mustChangePassword !== undefined) { sets.push(`must_change_password = $${idx++}`); vals.push(data.mustChangePassword) }

    if (sets.length === 0) return false
    vals.push(userId)
    const rows = await query<{ id: string }>(
      `UPDATE app.usuarios SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id`,
      vals
    )
    return rows.length > 0
  }

  async deactivate(userId: string): Promise<void> {
    await execute('UPDATE app.usuarios SET is_active = false WHERE id = $1', [userId])
  }
}
