// lib/repositories/admin.repository.ts
// Migrado de Google Sheets → Supabase

import { query, execute } from '@/lib/supabase/db'
import { TenantsRepository } from './plans-tenants-leads.repository'

// ── Log de Erros ──────────────────────────────────────────────

export interface LogErroRecord {
  timestamp: string
  no:        string
  erro:      string
  telefone:  string
  tenant:    string
  tenantId:  string
}

export class LogErrosRepository {
  async findAll(limit = 200): Promise<LogErroRecord[]> {
    const tenantsRepo = new TenantsRepository()
    const tenants     = await tenantsRepo.findAll()
    const results: LogErroRecord[] = []

    await Promise.allSettled(
      tenants
        .filter(t => t.supabaseSchema)
        .map(async tenant => {
          try {
            const rows = await query(
              `SELECT timestamp, no, erro, telefone FROM ${tenant.supabaseSchema}.log_erros ORDER BY timestamp DESC LIMIT $1`,
              [limit]
            )
            for (const r of rows) {
              results.push({
                timestamp: r.timestamp ? new Date(r.timestamp as string).toISOString() : '',
                no:        String(r.no ?? ''),
                erro:      String(r.erro ?? ''),
                telefone:  String(r.telefone ?? ''),
                tenant:    tenant.name,
                tenantId:  tenant.id,
              })
            }
          } catch {
            // Schema pode não existir ainda
          }
        })
    )

    return results
      .filter(r => r.timestamp)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
  }

  async findByTenant(tenantId: string): Promise<LogErroRecord[]> {
    const tenantsRepo = new TenantsRepository()
    const tenant      = await tenantsRepo.findById(tenantId)
    if (!tenant?.supabaseSchema) return []

    try {
      const rows = await query(
        `SELECT timestamp, no, erro, telefone FROM ${tenant.supabaseSchema}.log_erros ORDER BY timestamp DESC LIMIT 500`
      )
      return rows.map(r => ({
        timestamp: r.timestamp ? new Date(r.timestamp as string).toISOString() : '',
        no:        String(r.no ?? ''),
        erro:      String(r.erro ?? ''),
        telefone:  String(r.telefone ?? ''),
        tenant:    tenant.name,
        tenantId,
      }))
    } catch {
      return []
    }
  }

  async getStats(): Promise<{
    total:     number
    hoje:      number
    porTenant: Record<string, number>
    porNo:     Record<string, number>
  }> {
    const all   = await this.findAll()
    const today = new Date().toISOString().slice(0, 10)
    const porTenant: Record<string, number> = {}
    const porNo:     Record<string, number> = {}

    for (const r of all) {
      porTenant[r.tenant] = (porTenant[r.tenant] ?? 0) + 1
      const no = r.no || 'desconhecido'
      porNo[no] = (porNo[no] ?? 0) + 1
    }

    return {
      total:  all.length,
      hoje:   all.filter(r => r.timestamp.startsWith(today)).length,
      porTenant,
      porNo,
    }
  }
}

// ── Blacklist Global ──────────────────────────────────────────

export interface GlobalBlacklistRecord {
  telefone:  string
  motivo:    string
  atendente: string
  timestamp: string
  tenant:    string
  tenantId:  string
  scope:     'local' | 'global'
}

export class GlobalBlacklistRepository {
  /** Blacklist da tabela global (app.blacklist_global). */
  async findGlobal(): Promise<GlobalBlacklistRecord[]> {
    try {
      const rows = await query(
        'SELECT telefone, motivo, atendente, timestamp FROM app.blacklist_global ORDER BY timestamp DESC'
      )
      return rows.map(r => ({
        telefone:  String(r.telefone ?? ''),
        motivo:    String(r.motivo ?? ''),
        atendente: String(r.atendente ?? ''),
        timestamp: r.timestamp ? new Date(r.timestamp as string).toISOString() : '',
        tenant:    'Global (todos)',
        tenantId:  'global',
        scope:     'global' as const,
      }))
    } catch {
      return []
    }
  }

  async findAll(): Promise<GlobalBlacklistRecord[]> {
    const tenantsRepo = new TenantsRepository()
    const tenants     = await tenantsRepo.findAll()
    const global      = await this.findGlobal()
    const local: GlobalBlacklistRecord[] = []

    await Promise.allSettled(
      tenants
        .filter(t => t.supabaseSchema)
        .map(async tenant => {
          try {
            const rows = await query(
              `SELECT telefone, motivo, atendente, timestamp FROM ${tenant.supabaseSchema}.blacklist ORDER BY timestamp DESC`
            )
            for (const r of rows) {
              local.push({
                telefone:  String(r.telefone ?? ''),
                motivo:    String(r.motivo ?? ''),
                atendente: String(r.atendente ?? ''),
                timestamp: r.timestamp ? new Date(r.timestamp as string).toISOString() : '',
                tenant:    tenant.name,
                tenantId:  tenant.id,
                scope:     'local',
              })
            }
          } catch { /* schema pode não existir */ }
        })
    )

    return [...global, ...local]
      .filter(r => r.telefone)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  async addGlobal(telefone: string, motivo: string, adminId: string): Promise<void> {
    await execute(
      `INSERT INTO app.blacklist_global (telefone, motivo, atendente, timestamp)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (telefone) DO UPDATE SET motivo = EXCLUDED.motivo, atendente = EXCLUDED.atendente, timestamp = NOW()`,
      [telefone, motivo, adminId]
    )
  }
}
