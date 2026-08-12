// app/api/admin/migrate-to-supabase/route.ts
// Rota temporária de migração — lê Google Sheets e insere no Supabase.
// Protegida por MIGRATION_SECRET. Deletar após uso.
// Chamada: POST /api/admin/migrate-to-supabase
//          Header: x-migration-secret: <MIGRATION_SECRET>

import { NextRequest, NextResponse } from 'next/server'
import { readRange, rowsToObjects } from '@/lib/sheets/client'
import { execute, query } from '@/lib/supabase/client'

const MASTER_ID = process.env.GOOGLE_MASTER_SHEET_ID!
const SECRET    = process.env.MIGRATION_SECRET ?? 'comagente-migrate-2026'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// GET: pode ser chamado direto pelo navegador
// /api/admin/migrate-to-supabase?secret=comagente-migrate-2026
export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  return runMigration()
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Autenticação simples por secret header
  if (req.headers.get('x-migration-secret') !== SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  return runMigration()
}

async function runMigration(): Promise<NextResponse> {

  const log: string[] = []
  const errors: string[] = []

  // ── 1. Planos ────────────────────────────────────────────────
  try {
    const rows = await readRange(MASTER_ID, 'Planos!A:H')
    const planos = rowsToObjects<Record<string, string>>(rows)
    let count = 0
    for (const p of planos) {
      if (!p.id) continue
      await execute(
        `INSERT INTO app.planos (id, name, price, period, max_instances, max_attendants, features, is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, price = EXCLUDED.price,
           period = EXCLUDED.period, max_instances = EXCLUDED.max_instances,
           max_attendants = EXCLUDED.max_attendants, features = EXCLUDED.features,
           is_active = EXCLUDED.is_active`,
        [
          p.id, p.name ?? '', Number(p.price ?? 0), p.period ?? 'monthly',
          Number(p.maxInstances ?? 1), Number(p.maxAttendants ?? 2),
          p.features ?? '[]',
          p.isActive !== 'FALSE',
        ]
      )
      count++
    }
    log.push(`✓ Planos: ${count} registros`)
  } catch (err) {
    errors.push(`✗ Planos: ${err}`)
  }

  // ── 2. Empresas (Tenants) ────────────────────────────────────
  // Cada empresa mantém seu spreadsheetId como id para não quebrar sessões existentes
  const tenantSchemaMap: Record<string, string> = {}
  try {
    const rows = await readRange(MASTER_ID, 'Empresas!A:I')
    if (rows.length < 2) throw new Error('Aba Empresas vazia')
    let count = 0
    for (const r of rows.slice(1)) {
      const id        = String(r[0] ?? '').trim()
      const name      = String(r[1] ?? '').trim()
      const email     = String(r[2] ?? '').toLowerCase().trim()
      const phone     = String(r[3] ?? '')
      const planId    = String(r[4] ?? '')
      const status    = String(r[5] ?? 'trial')
      const createdAt = String(r[6] ?? new Date().toISOString())
      const evoInst   = String(r[7] ?? '')
      const sheetId   = String(r[8] ?? '')

      if (!id || !email) continue

      // Deriva o schema a partir do nome da empresa
      const schemaSlug = name
        .toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
      const schema = `tenant_${schemaSlug}`
      tenantSchemaMap[id] = schema

      await execute(
        `INSERT INTO app.empresas
           (id, name, email, phone, plan_id, status, created_at, evolution_instance, spreadsheet_id, supabase_schema)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, email = EXCLUDED.email,
           phone = EXCLUDED.phone, plan_id = EXCLUDED.plan_id,
           status = EXCLUDED.status, evolution_instance = EXCLUDED.evolution_instance,
           spreadsheet_id = EXCLUDED.spreadsheet_id, supabase_schema = EXCLUDED.supabase_schema`,
        [id, name, email, phone, planId || null, status, createdAt, evoInst, sheetId, schema]
      )

      // Cria o schema do tenant se não existir
      try {
        await execute(`SELECT create_tenant_schema($1)`, [schema])
      } catch { /* schema pode já existir */ }

      count++
    }
    log.push(`✓ Empresas: ${count} registros`)
    log.push(`  Schemas criados: ${Object.values(tenantSchemaMap).join(', ')}`)
  } catch (err) {
    errors.push(`✗ Empresas: ${err}`)
  }

  // ── 3. Usuários ──────────────────────────────────────────────
  try {
    const rows = await readRange(MASTER_ID, 'Usuarios!A:P')
    if (rows.length < 2) throw new Error('Aba Usuarios vazia')
    const headers = rows[0]
    let count = 0
    for (const r of rows.slice(1)) {
      if (!r[0] || !r[2]) continue // sem id ou email
      const raw: Record<string, string> = {}
      headers.forEach((h, i) => { if (h) raw[h] = r[i] ?? '' })
      raw.mustChangePassword  = r[14] ?? ''
      raw.canViewAgendamentos = r[15] ?? ''

      const tenantId = raw.tenantId ?? ''
      // Verifica se a empresa existe no Supabase
      const empresaExists = await query('SELECT 1 FROM app.empresas WHERE id = $1', [tenantId])
      if (empresaExists.length === 0) {
        errors.push(`  ⚠ Usuário ${raw.email}: tenant ${tenantId} não encontrado — pulado`)
        continue
      }

      await execute(
        `INSERT INTO app.usuarios
           (id, tenant_id, email, password_hash, name, role, phone,
            can_view_dashboard, can_view_crm, can_view_transcricoes,
            can_view_satisfacao, can_view_agendamentos,
            created_at, is_active, avatar_url, must_change_password)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (id) DO UPDATE SET
           email = EXCLUDED.email, password_hash = EXCLUDED.password_hash,
           name = EXCLUDED.name, role = EXCLUDED.role, phone = EXCLUDED.phone,
           can_view_dashboard = EXCLUDED.can_view_dashboard,
           can_view_crm = EXCLUDED.can_view_crm,
           can_view_transcricoes = EXCLUDED.can_view_transcricoes,
           can_view_satisfacao = EXCLUDED.can_view_satisfacao,
           can_view_agendamentos = EXCLUDED.can_view_agendamentos,
           is_active = EXCLUDED.is_active, avatar_url = EXCLUDED.avatar_url,
           must_change_password = EXCLUDED.must_change_password`,
        [
          raw.id, tenantId, raw.email.toLowerCase().trim(), raw.passwordHash ?? '',
          raw.name ?? '', raw.role ?? 'atendente', raw.phone ?? '',
          raw.canViewDashboard === 'TRUE',
          raw.canViewCRM === 'TRUE',
          raw.canViewTranscricoes === 'TRUE',
          raw.canViewSatisfacao === 'TRUE',
          raw.canViewAgendamentos === 'TRUE',
          raw.createdAt || new Date().toISOString(),
          raw.isActive !== 'FALSE',
          raw.avatarUrl ?? '',
          raw.mustChangePassword === 'TRUE',
        ]
      )
      count++
    }
    log.push(`✓ Usuários: ${count} registros`)
  } catch (err) {
    errors.push(`✗ Usuários: ${err}`)
  }

  // ── 4. Clientes (aba de cada tenant) ────────────────────────
  for (const [tenantId, schema] of Object.entries(tenantSchemaMap)) {
    try {
      const rows = await readRange(tenantId, 'Clientes!A:B')
      if (rows.length < 2) continue
      const [header, ...data] = rows
      const colT = header.findIndex(h => h.toLowerCase().includes('telefone'))
      const colN = header.findIndex(h => h.toLowerCase().includes('nome'))
      if (colT === -1 || colN === -1) continue
      let count = 0
      for (const r of data) {
        const telefone = (r[colT] ?? '').replace(/\D/g, '')
        const nome     = (r[colN] ?? '').trim()
        if (!telefone || !nome) continue
        await execute(
          `INSERT INTO ${schema}.clientes (telefone, nome)
           VALUES ($1, $2)
           ON CONFLICT (telefone) DO UPDATE SET nome = EXCLUDED.nome`,
          [telefone, nome]
        )
        count++
      }
      log.push(`✓ Clientes [${schema}]: ${count} registros`)
    } catch (err) {
      errors.push(`✗ Clientes [${schema}]: ${err}`)
    }
  }

  return NextResponse.json({
    success: errors.length === 0,
    log,
    errors,
    tenantSchemas: tenantSchemaMap,
  })
}
