// ─────────────────────────────────────────────────────────────
// app/api/tenants/route.ts
// GET  /api/tenants     — master only
// POST /api/tenants     — master only, provisionamento de novo tenant
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { TenantsRepository } from '@/lib/repositories/plans-tenants-leads.repository'
import { UsersRepository } from '@/lib/repositories/users.repository'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import type { ApiResponse, UserRecord } from '@/types'

const TenantSchema = z.object({
  name:              z.string().min(2),
  email:             z.string().email(),
  phone:             z.string().min(8),
  planId:            z.string().min(1),
  supervisorName:    z.string().min(2),
  supervisorEmail:   z.string().email(),
  supervisorPassword: z.string().min(8),
  // ID da planilha Google Sheets criada para este tenant
  spreadsheetId:     z.string().min(10),
  evolutionInstance: z.string().optional(),
})

const tenantsRepo = new TenantsRepository()

export async function GET(): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'master') {
    return NextResponse.json({ success: false, error: 'Apenas Master Admin' }, { status: 403 })
  }
  try {
    const tenants = await tenantsRepo.findAll()
    return NextResponse.json({ success: true, data: tenants })
  } catch (err) {
    console.error('[/api/tenants GET]', err)
    return NextResponse.json({ success: false, error: 'Erro ao buscar tenants' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'master') {
    return NextResponse.json({ success: false, error: 'Apenas Master Admin' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = TenantSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Dados inválidos', data: parsed.error.flatten() },
      { status: 422 }
    )
  }

  const d = parsed.data

  try {
    // 1. Cria o tenant na planilha Master
    const tenant = await tenantsRepo.create({
      name:              d.name,
      email:             d.email,
      phone:             d.phone,
      planId:            d.planId,
      status:            'active',
      evolutionInstance: d.evolutionInstance,
    })

    // 2. Cria o usuário Supervisor na planilha MASTER (necessário para o login)
    //    com tenantId = spreadsheetId da planilha do tenant
    const usersRepo = new UsersRepository() // master
    const passwordHash = await bcrypt.hash(d.supervisorPassword, 12)

    const supervisor: UserRecord = {
      id:                  randomUUID(),
      tenantId:            d.spreadsheetId, // aponta para a planilha do tenant
      email:               d.supervisorEmail,
      passwordHash,
      name:                d.supervisorName,
      role:                'supervisor',
      phone:               d.phone,
      canViewDashboard:    true,
      canViewCRM:          true,
      canViewTranscricoes: true,
      canViewSatisfacao:   true,
      createdAt:           new Date().toISOString(),
      isActive:            true,
    }
    await usersRepo.create(supervisor)

    return NextResponse.json({
      success: true,
      message: 'Tenant provisionado com sucesso.',
      data: { tenantId: tenant.id, supervisorId: supervisor.id },
    }, { status: 201 })
  } catch (err) {
    console.error('[/api/tenants POST]', err)
    return NextResponse.json({ success: false, error: 'Erro ao provisionar tenant' }, { status: 500 })
  }
}
