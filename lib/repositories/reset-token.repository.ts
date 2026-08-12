// lib/repositories/reset-token.repository.ts
// Migrado de Google Sheets → Supabase (schema: app)

import { query, queryOne, execute } from '@/lib/supabase/client'
import crypto from 'crypto'

const TTL_MS = 60 * 60 * 1000  // 1 hora

export interface ResetTokenRecord {
  token:     string
  userId:    string
  email:     string
  expiresAt: string
  usedAt:    string
}

export class ResetTokenRepository {
  async create(userId: string, email: string): Promise<string> {
    await this.invalidateByUserId(userId)

    const token     = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + TTL_MS).toISOString()

    await execute(
      `INSERT INTO app.reset_tokens (token, user_id, email, expires_at, used_at)
       VALUES ($1, $2, $3, $4, NULL)`,
      [token, userId, email.toLowerCase().trim(), expiresAt]
    )
    return token
  }

  async verify(token: string): Promise<ResetTokenRecord | null> {
    const row = await queryOne(
      'SELECT * FROM app.reset_tokens WHERE token = $1',
      [token]
    )
    if (!row) return null

    const record: ResetTokenRecord = {
      token:     String(row.token),
      userId:    String(row.user_id),
      email:     String(row.email),
      expiresAt: row.expires_at ? new Date(row.expires_at as string).toISOString() : '',
      usedAt:    row.used_at    ? new Date(row.used_at as string).toISOString()    : '',
    }

    if (record.usedAt) return null
    if (new Date(record.expiresAt).getTime() < Date.now()) return null
    return record
  }

  async consume(token: string): Promise<void> {
    await execute(
      'UPDATE app.reset_tokens SET used_at = NOW() WHERE token = $1',
      [token]
    )
  }

  private async invalidateByUserId(userId: string): Promise<void> {
    await execute(
      `UPDATE app.reset_tokens
       SET used_at = NOW()
       WHERE user_id = $1 AND used_at IS NULL`,
      [userId]
    )
  }
}
