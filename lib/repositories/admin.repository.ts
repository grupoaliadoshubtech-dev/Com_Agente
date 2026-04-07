// ─────────────────────────────────────────────────────────────
// lib/repositories/admin.repository.ts
// Repositórios exclusivos do Master Admin:
//   LogErrosRepository   — lê aba Log_Erros de cada tenant
//   GlobalBlacklistRepository — blacklist cross-tenant
// ─────────────────────────────────────────────────────────────

import { readRange, appendRows, rowsToObjects } from '@/lib/sheets/client'
import { TenantsRepository } from './plans-tenants-leads.repository'

const MASTER_ID = process.env.GOOGLE_MASTER_SHEET_ID!

// ── Log de Erros ──────────────────────────────────────────────

export interface LogErroRecord {
  timestamp: string
  no:        string   // nó do n8n ou rota da API
  erro:      string
  telefone:  string
  tenant:    string   // nome do tenant
  tenantId:  string
}

export class LogErrosRepository {
  /**
   * Agrega logs de erros de TODOS os tenants ativos.
   * Lê a aba Log_Erros de cada planilha de tenant.
   */
  async findAll(limit = 200): Promise<LogErroRecord[]> {
    const tenantsRepo = new TenantsRepository()
    const tenants     = await tenantsRepo.findAll()

    const results: LogErroRecord[] = []

    // Leitura paralela para não travar em tenants com muitos erros
    await Promise.allSettled(
      tenants.map(async tenant => {
        try {
          const rows    = await readRange(tenant.id, 'Log_Erros!A:D')
          const records = rowsToObjects<Record<string, string>>(rows)
          for (const r of records) {
            results.push({
              timestamp: r.timestamp ?? r.Timestamp ?? '',
              no:        r.no        ?? r.No        ?? r['Nó'] ?? '',
              erro:      r.erro      ?? r.Erro      ?? '',
              telefone:  r.telefone  ?? r.Telefone  ?? '',
              tenant:    tenant.name,
              tenantId:  tenant.id,
            })
          }
        } catch {
          // Tenant pode não ter a aba ainda — ignorar silenciosamente
        }
      })
    )

    // Mais recente primeiro, limitado
    return results
      .filter(r => r.timestamp)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit)
  }

  async findByTenant(tenantId: string): Promise<LogErroRecord[]> {
    const tenantsRepo = new TenantsRepository()
    const tenant      = await tenantsRepo.findById(tenantId)
    if (!tenant) return []

    try {
      const rows    = await readRange(tenantId, 'Log_Erros!A:D')
      const records = rowsToObjects<Record<string, string>>(rows)
      return records.map(r => ({
        timestamp: r.timestamp ?? '',
        no:        r.no        ?? r['Nó'] ?? '',
        erro:      r.erro      ?? '',
        telefone:  r.telefone  ?? '',
        tenant:    tenant.name,
        tenantId,
      })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
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
  /**
   * Lista blacklist da planilha MASTER (scope global).
   * Números aqui são bloqueados em todos os tenants.
   */
  async findGlobal(): Promise<GlobalBlacklistRecord[]> {
    const rows = await readRange(MASTER_ID, 'Blacklist!A:E')
    return rowsToObjects<Record<string, string>>(rows).map(r => ({
      telefone:  r.telefone  ?? '',
      motivo:    r.motivo    ?? '',
      atendente: r.atendente ?? '',
      timestamp: r.timestamp ?? '',
      tenant:    'Global (todos)',
      tenantId:  MASTER_ID,
      scope:     'global' as const,
    }))
  }

  /** Agrega blacklists de todos os tenants + global. */
  async findAll(): Promise<GlobalBlacklistRecord[]> {
    const tenantsRepo = new TenantsRepository()
    const tenants     = await tenantsRepo.findAll()
    const global      = await this.findGlobal()
    const local: GlobalBlacklistRecord[] = []

    await Promise.allSettled(
      tenants.map(async tenant => {
        try {
          const rows    = await readRange(tenant.id, 'Blacklist!A:D')
          const records = rowsToObjects<Record<string, string>>(rows)
          for (const r of records) {
            local.push({
              telefone:  r.telefone  ?? '',
              motivo:    r.motivo    ?? '',
              atendente: r.atendente ?? '',
              timestamp: r.timestamp ?? '',
              tenant:    tenant.name,
              tenantId:  tenant.id,
              scope:     'local',
            })
          }
        } catch { /* aba pode não existir ainda */ }
      })
    )

    return [...global, ...local]
      .filter(r => r.telefone)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  /** Adiciona número à blacklist global (Master). */
  async addGlobal(telefone: string, motivo: string, adminId: string): Promise<void> {
    await appendRows(MASTER_ID, 'Blacklist!A:E', [[
      telefone,
      motivo,
      adminId,
      new Date().toISOString(),
      'global',
    ]])
  }
}
