// ─────────────────────────────────────────────────────────────
// lib/repositories/plans.repository.ts
//
// Aba "Planos" da planilha MASTER.
// Colunas: id | name | price | period | maxInstances |
//          maxAttendants | features (JSON) | isActive
// ─────────────────────────────────────────────────────────────

import { readRange, appendRows, smartAppend, updateRange, rowsToObjects } from '@/lib/sheets/client'
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

  async findAll(): Promise<Tenant[]> {
    const rows = await readRange(this.spreadsheetId, `${this.sheet}!A:I`)
    if (rows.length < 2) return []
    // Leitura posicional: A=0 id, B=1 name, C=2 email, D=3 phone, E=4 planId,
    // F=5 status, G=6 createdAt, H=7 evolutionInstance, I=8 spreadsheetId
    return rows.slice(1)
      .filter(r => r[0] && r[2])
      .map(r => ({
        id:                String(r[0] ?? ''),
        name:              String(r[1] ?? ''),
        email:             String(r[2] ?? '').toLowerCase().trim(),
        phone:             String(r[3] ?? ''),
        planId:            String(r[4] ?? ''),
        status:            (String(r[5] ?? 'trial')) as Tenant['status'],
        createdAt:         String(r[6] ?? ''),
        evolutionInstance: String(r[7] ?? ''),
        spreadsheetId:     String(r[8] ?? ''),
      }))
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
    await smartAppend(this.spreadsheetId, this.sheet, [[
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
    const rows = await readRange(this.spreadsheetId, `${this.sheet}!A:F`)
    if (rows.length < 2) return
    // Posicional: id=A(0), status=F(5)
    const rowIndex = rows.findIndex((r, i) => i > 0 && (r[0] ?? '') === id)
    if (rowIndex === -1) return
    const sheetRow = rowIndex + 1
    await updateRange(this.spreadsheetId, `${this.sheet}!F${sheetRow}`, [[status]])
  }

  async updateTenant(id: string, data: Partial<Pick<Tenant, 'name' | 'email' | 'phone' | 'planId' | 'evolutionInstance' | 'status' | 'spreadsheetId'>>): Promise<boolean> {
    const rows = await readRange(this.spreadsheetId, `${this.sheet}!A:I`)
    if (rows.length < 2) return false

    // Localiza a linha pelo id (coluna A = índice 0, posicional)
    const rowIndex = rows.findIndex((r, i) => i > 0 && (r[0] ?? '') === id)
    if (rowIndex === -1) return false
    const sheetRow = rowIndex + 1

    // Lê a linha atual e aplica os campos por posição conhecida:
    // A=0:id  B=1:name  C=2:email  D=3:phone  E=4:planId
    // F=5:status  G=6:createdAt  H=7:evolutionInstance  I=8:spreadsheetId
    const current = [...(rows[rowIndex] ?? [])]
    while (current.length < 9) current.push('')

    if (data.name              !== undefined) current[1] = data.name
    if (data.email             !== undefined) current[2] = data.email
    if (data.phone             !== undefined) current[3] = data.phone
    if (data.planId            !== undefined) current[4] = data.planId
    if (data.status            !== undefined) current[5] = data.status
    if (data.evolutionInstance !== undefined) current[7] = data.evolutionInstance
    if (data.spreadsheetId     !== undefined) current[8] = data.spreadsheetId

    await updateRange(this.spreadsheetId, `${this.sheet}!A${sheetRow}:I${sheetRow}`, [current])
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
    await smartAppend(this.spreadsheetId, this.sheet, [[
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

  async findById(id: string): Promise<LeadRecord | null> {
    const all = await this.findAll()
    return all.find(l => l.id === id) ?? null
  }

  async updateById(id: string, data: Partial<Pick<LeadRecord, 'name' | 'email' | 'phone' | 'company' | 'planId' | 'planName' | 'status'>>): Promise<boolean> {
    const rows = await readRange(this.spreadsheetId, `${this.sheet}!A:I`)
    if (rows.length < 2) return false
    // Leitura posicional: id=A(0), name=B(1), email=C(2), phone=D(3),
    // company=E(4), planId=F(5), planName=G(6), status=H(7), createdAt=I(8)
    const rowIndex = rows.findIndex((r, i) => i > 0 && (r[0] ?? '') === id)
    if (rowIndex === -1) return false
    const sheetRow = rowIndex + 1
    const current  = [...(rows[rowIndex] ?? [])]
    while (current.length < 9) current.push('')
    if (data.name     !== undefined) current[1] = data.name
    if (data.email    !== undefined) current[2] = data.email
    if (data.phone    !== undefined) current[3] = data.phone
    if (data.company  !== undefined) current[4] = data.company
    if (data.planId   !== undefined) current[5] = data.planId
    if (data.planName !== undefined) current[6] = data.planName
    if (data.status   !== undefined) current[7] = data.status
    await updateRange(this.spreadsheetId, `${this.sheet}!A${sheetRow}:I${sheetRow}`, [current])
    return true
  }
}
