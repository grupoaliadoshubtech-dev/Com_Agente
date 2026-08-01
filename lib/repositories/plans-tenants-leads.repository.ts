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
      id:                raw.id,
      name:              raw.name,
      email:             raw.email?.toLowerCase().trim(),
      phone:             raw.phone ?? '',
      planId:            raw.planId ?? '',
      status:            (raw.status ?? 'trial') as Tenant['status'],
      createdAt:         raw.createdAt,
      evolutionInstance: raw.evolutionInstance ?? '',
      spreadsheetId:     raw.spreadsheetId ?? '',
    }
  }

  async findAll(): Promise<Tenant[]> {
    const rows = await readRange(this.spreadsheetId, `${this.sheet}!A:I`)
    return rowsToObjects<Record<string, string>>(rows).map(this.parse)
  }

  async findById(id: string): Promise<Tenant | null> {
    const all = await this.findAll()
    return all.find(t => t.id === id) ?? null
  }

  async create(data: Omit<Tenant, 'createdAt'>): Promise<Tenant> {
    const { id: providedId, ...rest } = data
    const tenant: Tenant = {
      id:        providedId ?? randomUUID(),
      createdAt: new Date().toISOString(),
      ...rest,
    }
    await appendRows(this.spreadsheetId, `${this.sheet}!A:I`, [[
      tenant.id,
      tenant.name,
      tenant.email,
      tenant.phone,
      tenant.planId,
      tenant.status,
      tenant.createdAt,
      tenant.evolutionInstance ?? '',
      tenant.spreadsheetId    ?? '',
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

  async updateTenant(id: string, data: Partial<Pick<Tenant, 'name' | 'email' | 'phone' | 'planId' | 'evolutionInstance' | 'status' | 'spreadsheetId'>>): Promise<boolean> {
    const rows = await readRange(this.spreadsheetId, `${this.sheet}!A:I`)
    if (rows.length < 2) return false
    const headers  = rows[0]
    const idCol    = headers.indexOf('id')
    const rowIndex = rows.findIndex((r, i) => i > 0 && r[idCol] === id)
    if (rowIndex === -1) return false
    const sheetRow = rowIndex + 1
    const updates: Promise<void>[] = []
    const col = (name: string) => String.fromCharCode(65 + headers.indexOf(name))
    if (data.name              !== undefined) updates.push(updateRange(this.spreadsheetId, `${this.sheet}!${col('name')}${sheetRow}`,              [[data.name]]))
    if (data.email             !== undefined) updates.push(updateRange(this.spreadsheetId, `${this.sheet}!${col('email')}${sheetRow}`,             [[data.email]]))
    if (data.phone             !== undefined) updates.push(updateRange(this.spreadsheetId, `${this.sheet}!${col('phone')}${sheetRow}`,             [[data.phone]]))
    if (data.planId            !== undefined) updates.push(updateRange(this.spreadsheetId, `${this.sheet}!${col('planId')}${sheetRow}`,            [[data.planId]]))
    if (data.status            !== undefined) updates.push(updateRange(this.spreadsheetId, `${this.sheet}!${col('status')}${sheetRow}`,            [[data.status]]))
    if (data.evolutionInstance !== undefined) updates.push(updateRange(this.spreadsheetId, `${this.sheet}!${col('evolutionInstance')}${sheetRow}`, [[data.evolutionInstance]]))
    if (data.spreadsheetId     !== undefined) updates.push(updateRange(this.spreadsheetId, `${this.sheet}!${col('spreadsheetId')}${sheetRow}`,     [[data.spreadsheetId]]))
    await Promise.all(updates)
    return true
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
    if (rows.length < 2) return []
    // Leitura posicional: imune a variação nos nomes dos cabeçalhos da planilha
    // Ordem das colunas: id(A) | name(B) | email(C) | phone(D) | company(E) | planId(F) | planName(G) | status(H) | createdAt(I)
    return rows.slice(1).map(row => ({
      id:        row[0] ?? '',
      name:      row[1] ?? '',
      email:     row[2] ?? '',
      phone:     row[3] ?? '',
      company:   row[4] ?? '',
      planId:    row[5] ?? '',
      planName:  row[6] ?? '',
      status:    (row[7] ?? 'new') as LeadRecord['status'],
      createdAt: row[8] ?? '',
    }))
  }

  async updateById(id: string, data: Partial<Pick<LeadRecord, 'name' | 'email' | 'phone' | 'company' | 'planId' | 'planName' | 'status'>>): Promise<boolean> {
    const rows = await readRange(this.spreadsheetId, `${this.sheet}!A:I`)
    if (rows.length < 2) return false
    const headers  = rows[0]
    const idCol    = headers.indexOf('id')
    const rowIndex = rows.findIndex((r, i) => i > 0 && r[idCol] === id)
    if (rowIndex === -1) return false
    const sheetRow = rowIndex + 1
    const col      = (name: string) => String.fromCharCode(65 + headers.indexOf(name))
    const updates: Promise<void>[] = []
    if (data.name     !== undefined) updates.push(updateRange(this.spreadsheetId, `${this.sheet}!${col('name')}${sheetRow}`,     [[data.name]]))
    if (data.email    !== undefined) updates.push(updateRange(this.spreadsheetId, `${this.sheet}!${col('email')}${sheetRow}`,    [[data.email]]))
    if (data.phone    !== undefined) updates.push(updateRange(this.spreadsheetId, `${this.sheet}!${col('phone')}${sheetRow}`,    [[data.phone]]))
    if (data.company  !== undefined) updates.push(updateRange(this.spreadsheetId, `${this.sheet}!${col('company')}${sheetRow}`,  [[data.company]]))
    if (data.planId   !== undefined) updates.push(updateRange(this.spreadsheetId, `${this.sheet}!${col('planId')}${sheetRow}`,   [[data.planId]]))
    if (data.planName !== undefined) updates.push(updateRange(this.spreadsheetId, `${this.sheet}!${col('planName')}${sheetRow}`, [[data.planName]]))
    if (data.status   !== undefined) updates.push(updateRange(this.spreadsheetId, `${this.sheet}!${col('status')}${sheetRow}`,   [[data.status]]))
    await Promise.all(updates)
    return true
  }
}
