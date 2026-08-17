// lib/repositories/plans-tenants-leads.repository.ts
// Migrado de Google Sheets → Supabase (schema: app)

import { query, queryOne, execute } from '@/lib/supabase/client'
import type { Plan, Tenant, LeadRecord } from '@/types'
import { randomUUID } from 'crypto'

// ══════════════════════════════════════════════════════════════
// PLANS REPOSITORY
// ══════════════════════════════════════════════════════════════

export class PlansRepository {
  private parse(row: Record<string, unknown>): Plan {
    let features: string[] = []
    try { features = Array.isArray(row.features) ? row.features as string[] : JSON.parse(String(row.features ?? '[]')) } catch { /* noop */ }
    return {
      id:            String(row.id),
      name:          String(row.name),
      price:         Number(row.price ?? 0),
      period:        String(row.period ?? 'monthly') as Plan['period'],
      maxInstances:  Number(row.max_instances ?? 1),
      maxAttendants: Number(row.max_attendants ?? 2),
      maxMessages:   row.max_messages != null ? Number(row.max_messages) : null,
      features,
      isActive:      Boolean(row.is_active),
    }
  }

  async findAll(): Promise<Plan[]> {
    const rows = await query('SELECT * FROM app.planos WHERE is_active = true ORDER BY name')
    return rows.map(r => this.parse(r))
  }

  async findById(id: string): Promise<Plan | null> {
    const row = await queryOne('SELECT * FROM app.planos WHERE id = $1', [id])
    return row ? this.parse(row) : null
  }

  async create(plan: Omit<Plan, 'id'>): Promise<Plan> {
    const id = randomUUID()
    await execute(
      `INSERT INTO app.planos (id, name, price, period, max_instances, max_attendants, max_messages, features, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, plan.name, plan.price, plan.period, plan.maxInstances, plan.maxAttendants, plan.maxMessages ?? null, JSON.stringify(plan.features), plan.isActive]
    )
    return { id, ...plan }
  }
}

// ══════════════════════════════════════════════════════════════
// TENANTS REPOSITORY
// ══════════════════════════════════════════════════════════════

export class TenantsRepository {
  private parse(row: Record<string, unknown>): Tenant {
    return {
      id:                String(row.id),
      name:              String(row.name),
      email:             String(row.email ?? '').toLowerCase().trim(),
      phone:             String(row.phone ?? ''),
      planId:            String(row.plan_id ?? ''),
      status:            String(row.status ?? 'trial') as Tenant['status'],
      createdAt:         row.created_at ? new Date(row.created_at as string).toISOString() : '',
      evolutionInstance: String(row.evolution_instance ?? ''),
      spreadsheetId:     String(row.spreadsheet_id ?? ''),
      supabaseSchema:    String(row.supabase_schema ?? ''),
    }
  }

  async findAll(): Promise<Tenant[]> {
    const rows = await query('SELECT * FROM app.empresas ORDER BY name')
    return rows.map(r => this.parse(r))
  }

  async findById(id: string): Promise<Tenant | null> {
    const row = await queryOne('SELECT * FROM app.empresas WHERE id = $1', [id])
    return row ? this.parse(row) : null
  }

  async create(data: Omit<Tenant, 'createdAt'>): Promise<Tenant> {
    const tenant: Tenant = {
      ...data,
      id:        data.id ?? randomUUID(),
      createdAt: new Date().toISOString(),
    }
    await execute(
      `INSERT INTO app.empresas
         (id, name, email, phone, plan_id, status, created_at, evolution_instance, spreadsheet_id, supabase_schema)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        tenant.id, tenant.name, tenant.email, tenant.phone,
        tenant.planId, tenant.status, tenant.createdAt,
        tenant.evolutionInstance ?? '',
        tenant.spreadsheetId    ?? '',
        (tenant as Tenant & { supabaseSchema?: string }).supabaseSchema ?? '',
      ]
    )
    return tenant
  }

  async updateStatus(id: string, status: Tenant['status']): Promise<void> {
    await execute('UPDATE app.empresas SET status = $1 WHERE id = $2', [status, id])
  }

  async updateTenant(
    id: string,
    data: Partial<Pick<Tenant, 'name' | 'email' | 'phone' | 'planId' | 'evolutionInstance' | 'status' | 'spreadsheetId'> & { supabaseSchema?: string }>
  ): Promise<boolean> {
    const sets: string[]   = []
    const vals: unknown[]  = []
    let   idx              = 1

    if (data.name              !== undefined) { sets.push(`name = $${idx++}`);               vals.push(data.name) }
    if (data.email             !== undefined) { sets.push(`email = $${idx++}`);              vals.push(data.email) }
    if (data.phone             !== undefined) { sets.push(`phone = $${idx++}`);              vals.push(data.phone) }
    if (data.planId            !== undefined) { sets.push(`plan_id = $${idx++}`);            vals.push(data.planId) }
    if (data.status            !== undefined) { sets.push(`status = $${idx++}`);             vals.push(data.status) }
    if (data.evolutionInstance !== undefined) { sets.push(`evolution_instance = $${idx++}`); vals.push(data.evolutionInstance) }
    if (data.spreadsheetId     !== undefined) { sets.push(`spreadsheet_id = $${idx++}`);    vals.push(data.spreadsheetId) }
    if (data.supabaseSchema    !== undefined) { sets.push(`supabase_schema = $${idx++}`);   vals.push(data.supabaseSchema) }

    if (sets.length === 0) return false
    vals.push(id)
    await execute(`UPDATE app.empresas SET ${sets.join(', ')} WHERE id = $${idx}`, vals)
    return true
  }
}

// ══════════════════════════════════════════════════════════════
// LEADS REPOSITORY
// ══════════════════════════════════════════════════════════════

export class LeadsRepository {
  private parse(row: Record<string, unknown>): LeadRecord {
    return {
      id:        String(row.id),
      name:      String(row.name ?? ''),
      email:     String(row.email ?? ''),
      phone:     String(row.phone ?? ''),
      company:   String(row.company ?? ''),
      planId:    String(row.plan_id ?? ''),
      planName:  String(row.plan_name ?? ''),
      status:    String(row.status ?? 'new') as LeadRecord['status'],
      createdAt: row.created_at ? new Date(row.created_at as string).toISOString() : '',
    }
  }

  async create(data: Omit<LeadRecord, 'id' | 'createdAt' | 'status'>): Promise<LeadRecord> {
    const id  = randomUUID()
    const now = new Date().toISOString()
    await execute(
      `INSERT INTO app.leads (id, name, email, phone, company, plan_id, plan_name, status, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, data.name, data.email, data.phone, data.company, data.planId, data.planName, 'new', now]
    )
    return { id, ...data, status: 'new', createdAt: now }
  }

  async findAll(): Promise<LeadRecord[]> {
    const rows = await query('SELECT * FROM app.leads ORDER BY created_at DESC')
    return rows.map(r => this.parse(r))
  }

  async findById(id: string): Promise<LeadRecord | null> {
    const row = await queryOne('SELECT * FROM app.leads WHERE id = $1', [id])
    return row ? this.parse(row) : null
  }

  async updateById(
    id: string,
    data: Partial<Pick<LeadRecord, 'name' | 'email' | 'phone' | 'company' | 'planId' | 'planName' | 'status'>>
  ): Promise<boolean> {
    const sets: string[]  = []
    const vals: unknown[] = []
    let   idx             = 1

    if (data.name     !== undefined) { sets.push(`name = $${idx++}`);      vals.push(data.name) }
    if (data.email    !== undefined) { sets.push(`email = $${idx++}`);     vals.push(data.email) }
    if (data.phone    !== undefined) { sets.push(`phone = $${idx++}`);     vals.push(data.phone) }
    if (data.company  !== undefined) { sets.push(`company = $${idx++}`);   vals.push(data.company) }
    if (data.planId   !== undefined) { sets.push(`plan_id = $${idx++}`);   vals.push(data.planId) }
    if (data.planName !== undefined) { sets.push(`plan_name = $${idx++}`); vals.push(data.planName) }
    if (data.status   !== undefined) { sets.push(`status = $${idx++}`);    vals.push(data.status) }

    if (sets.length === 0) return false
    vals.push(id)
    await execute(`UPDATE app.leads SET ${sets.join(', ')} WHERE id = $${idx}`, vals)
    return true
  }
}
