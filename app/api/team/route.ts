// ─────────────────────────────────────────────────────────────
// app/api/team/route.ts
// GET  /api/team  — lista equipe do tenant (filtra por tenantId na master)
// POST /api/team  — cria novo atendente na master com tenantId do supervisor
// PATCH           — atualiza toggles de permissão na master
// DELETE          — desativa atendente na master (soft delete)
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { UsersRepository } from '@/lib/repositories/users.repository'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import type { ApiResponse, UserRecord } from '@/types'

const CreateAttendantSchema = z.object({
  name:     z.string().min(2),
  email:    z.string().email(),
  phone:    z.string().optional(),
  password: z.string().min(8),
})

const ToggleSchema = z.object({
  userId:              z.string(),
  canViewDashboard:    z.boolean(),
  canViewCRM:          z.boolean(),
  canViewTranscricoes: z.boolean(),
  canViewSatisfacao:   z.boolean(),
})

function isSupervisorOrMaster(role?: string) {
  return role === 'supervisor' || role === 'master'
}

export async function GET(): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isSupervisorOrMaster(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Acesso negado' }, { status: 403 })
  }

  const repo = new UsersRepository() // sempre master
  try {
    const users = await repo.findByTenantId(session.user.tenantId)
    const safe = users.map(({ passwordHash: _, ...u }) => u)
    return NextResponse.json({ success: true, data: safe })
  } catch (err) {
    console.error('[/api/team GET]', err)
    return NextResponse.json({ success: false, error: 'Erro ao buscar equipe' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isSupervisorOrMaster(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Acesso negado' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = CreateAttendantSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Dados inválidos', data: parsed.error.flatten() }, { status: 422 })
  }

  const repo = new UsersRepository() // sempre master

  // Verifica se e-mail já existe (em toda a master)
  const existing = await repo.findByEmail(parsed.data.email)
  if (existing) {
    return NextResponse.json({ success: false, error: 'E-mail já cadastrado' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12)

  const attendant: UserRecord = {
    id:                  randomUUID(),
    tenantId:            session.user.tenantId,
    email:               parsed.data.email,
    passwordHash,
    name:                parsed.data.name,
    role:                'atendente',
    phone:               parsed.data.phone ?? '',
    // Começa sem acesso a dashboards — supervisor libera via toggles
    canViewDashboard:    false,
    canViewCRM:          false,
    canViewTranscricoes: false,
    canViewSatisfacao:   false,
    createdAt:           new Date().toISOString(),
    isActive:            true,
  }

  try {
    await repo.create(attendant)
    const { passwordHash: _, ...safe } = attendant
    return NextResponse.json({ success: true, data: safe }, { status: 201 })
  } catch (err) {
    console.error('[/api/team POST]', err)
    return NextResponse.json({ success: false, error: 'Erro ao criar atendente' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user || !isSupervisorOrMaster(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Acesso negado' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = ToggleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Dados inválidos' }, { status: 422 })
  }

  const repo = new UsersRepository() // sempre master
  try {
    await repo.updateToggles(parsed.data.userId, {
      canViewDashboard:    parsed.data.canViewDashboard,
      canViewCRM:          parsed.data.canViewCRM,
      canViewTranscricoes: parsed.data.canViewTranscricoes,
      canViewSatisfacao:   parsed.data.canViewSatisfacao,
    })
    return NextResponse.json({ success: true, message: 'Permissões atualizadas' })
  } catch (err) {
    console.error('[/api/team PATCH]', err)
    return NextResponse.json({ success: false, error: 'Erro ao atualizar permissões' }, { status: 500 })
  }
}
