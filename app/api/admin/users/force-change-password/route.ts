// app/api/admin/users/force-change-password/route.ts
// POST { userId } — marca mustChangePassword=true para um usuário (master only)
// PATCH { tenantId } — marca todos os supervisores de um tenant (master only)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { UsersRepository } from '@/lib/repositories/users.repository'
import type { ApiResponse } from '@/types'

const repo = new UsersRepository()

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'master') {
    return NextResponse.json({ success: false, error: 'Apenas Master Admin' }, { status: 403 })
  }

  let userId: string
  try {
    const body = await req.json()
    userId = body.userId
    if (!userId) throw new Error('userId ausente')
  } catch {
    return NextResponse.json({ success: false, error: 'Body inválido: { userId }' }, { status: 400 })
  }

  const ok = await repo.updateProfile(userId, { mustChangePassword: true })
  if (!ok) return NextResponse.json({ success: false, error: 'Usuário não encontrado' }, { status: 404 })

  return NextResponse.json({ success: true, message: 'Usuário marcado para redefinir senha no próximo acesso.' })
}

// Marca todos os usuários de um tenant (útil para tenants antigos)
export async function PATCH(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'master') {
    return NextResponse.json({ success: false, error: 'Apenas Master Admin' }, { status: 403 })
  }

  let tenantId: string | undefined
  try {
    const body = await req.json()
    tenantId = body.tenantId
  } catch {
    tenantId = undefined
  }

  const all = tenantId
    ? await repo.findByTenantId(tenantId)
    : (await repo.findAll()).filter(u => u.role !== 'master')

  let count = 0
  for (const u of all) {
    if (!u.mustChangePassword) {
      await repo.updateProfile(u.id, { mustChangePassword: true })
      count++
    }
  }

  return NextResponse.json({ success: true, message: `${count} usuário(s) marcado(s) para redefinir senha.`, data: { count } })
}
