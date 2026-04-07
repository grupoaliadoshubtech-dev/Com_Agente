// ─────────────────────────────────────────────────────────────
// lib/repositories/plans.repository.ts
//
// Aba "Planos" da planilha MASTER.
// Colunas: id | name | price | period | maxInstances |
//          maxAttendants | features (JSON) | isActive
// ─────────────────────────────────────────────────────────────

import { readRange, appendRows, updateRange, rowsToObjects } from '@/lib/sheets/client'
import type { Plan, Tenant, LeadRecord } from '@/types'
import { randomUUID } from 'crypto'

const MASTER_ID = process.env.GOOGLE_MASTER_SHEET_ID!

// ══════════════════════════════════════════════════════════════
// PLANS REPOSITORY
// ══════════════════════════════════════════════════════════════

export class PlansRepository {
  private spreadsheetId = MASTER_ID
  private sheet         = 'Planos'

  private parse(raw: Record<string, string>): Plan {
    let features: string[] = []
    try { features = JSON.parse(raw.features ?? '[]') } catch { /* noop */ }
    return {
      id:            raw.id,
      name:          raw.name,
      price:         Number(raw.price ?? 0),
      period:        (raw.period ?? 'monthly') as Plan['period'],
      maxInstances:  Number(raw.maxInstances ?? 1),
      maxAttendants: Number(raw.maxAttendants ?? 2),
      features,
      isActive:      raw.isActive !== 'FALSE',
    }
  }

  async findAll(): Promise<Plan[]> {
    const rows = await readRange(this.spreadsheetId, `${this.sheet}!A:H`)
    return rowsToObjects<Record<string, string>>(rows)
      .map(this.parse)
      .filter(p => p.isActive)
  }

  async findById(id: string): Promise<Plan | null> {
    const all = await this.findAll()
    return all.find(p => p.id === id) ?? null
  }

  async create(plan: Omit<Plan, 'id'>): Promise<Plan> {
    const newPlan: Plan = { id: randomUUID(), ...plan }
    await appendRows(this.spreadsheetId, `${this.sheet}!A:H`, [[
      newPlan.id,
      newPlan.name,
      newPlan.price,
      newPlan.period,
      newPlan.maxInstances,
      newPlan.maxAttendants,
      JSON.stringify(newPlan.features),
      newPlan.isActive,
    ]])
    return newPlan
  }
}

// ══════════════════════════════════════════════════════════════
// TENANTS REPOSITORY
// ══════════════════════════════════════════════════════════════
//
// Aba "Empresas" da planilha MASTER.
// Colunas: id | name | email | phone | planId | status |
//          createdAt | evolutionInstance
// ══════════════════════════════════════════════════════════════

export class TenantsRepository {
  private spreadsheetId = MASTER_ID
  private sheet         = 'Empresas'

  private parse(raw: Record<string, string>): Tenant {
    return {
      id:                 raw.id,
      name:               raw.name,
      email:              raw.email?.toLowerCase().trim(),
      phone:              raw.phone ?? '',
      planId:             raw.planId ?? '',
      status:             (raw.status ?? 'trial') as Tenant['status'],
      createdAt:          raw.createdAt,
      evolutionInstance:  raw.evolutionInstance ?? '',
    }
  }

  async findAll(): Promise<Tenant[]> {
    const rows = await readRange(this.spreadsheetId, `${this.sheet}!A:H`)
    return rowsToObjects<Record<string, string>>(rows).map(this.parse)
  }

  async findById(id: string): Promise<Tenant | null> {
    const all = await this.findAll()
    return all.find(t => t.id === id) ?? null
  }

  async create(data: Omit<Tenant, 'id' | 'createdAt'>): Promise<Tenant> {
    const tenant: Tenant = {
      id:        randomUUID(),
      createdAt: new Date().toISOString(),
      ...data,
    }
    await appendRows(this.spreadsheetId, `${this.sheet}!A:H`, [[
      tenant.id,
      tenant.name,
      tenant.email,
      tenant.phone,
      tenant.planId,
      tenant.status,
      tenant.createdAt,
      tenant.evolutionInstance ?? '',
    ]])
    return tenant
  }

  async updateStatus(id: string, status: Tenant['status']): Promise<void> {
    const rows = await readRange(this.spreadsheetId, `${this.sheet}!A:H`)
    if (rows.length < 2) return
    const headers  = rows[0]
    const idCol    = headers.indexOf('id')
    const rowIndex = rows.findIndex((r, i) => i > 0 && r[idCol] === id)
    if (rowIndex === -1) return
    const sheetRow = rowIndex + 1
    await updateRange(this.spreadsheetId, `${this.sheet}!F${sheetRow}`, [[status]])
  }
}

// ══════════════════════════════════════════════════════════════
// LEADS REPOSITORY
// ══════════════════════════════════════════════════════════════
//
// Aba "Leads" da planilha MASTER.
// Colunas: id | name | email | phone | company | planId |
//          planName | status | createdAt
// ══════════════════════════════════════════════════════════════

export class LeadsRepository {
  private spreadsheetId = MASTER_ID
  private sheet         = 'Leads'

  async create(data: Omit<LeadRecord, 'id' | 'createdAt' | 'status'>): Promise<LeadRecord> {
    const lead: LeadRecord = {
      id:        randomUUID(),
      status:    'new',
      createdAt: new Date().toISOString(),
      ...data,
    }
    await appendRows(this.spreadsheetId, `${this.sheet}!A:I`, [[
      lead.id,
      lead.name,
      lead.email,
      lead.phone,
      lead.company,
      lead.planId,
      lead.planName,
      lead.status,
      lead.createdAt,
    ]])
    return lead
  }

  async findAll(): Promise<LeadRecord[]> {
    const rows = await readRange(this.spreadsheetId, `${this.sheet}!A:I`)
    return rowsToObjects<Record<string, string>>(rows).map(r => ({
      id:        r.id,
      name:      r.name,
      email:     r.email,
      phone:     r.phone,
      company:   r.company,
      planId:    r.planId,
      planName:  r.planName,
      status:    (r.status ?? 'new') as LeadRecord['status'],
      createdAt: r.createdAt,
    }))
  }
}
