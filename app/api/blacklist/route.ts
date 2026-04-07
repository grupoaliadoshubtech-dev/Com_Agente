// app/api/blacklist/route.ts
// POST /api/blacklist  — adiciona número à blacklist (exige confirmação prévia no front)
// GET  /api/blacklist  — lista blacklist do tenant

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { BlacklistRepository } from '@/lib/repositories/blacklist.repository'
import { z } from 'zod'
import type { ApiResponse } from '@/types'

const AddSchema = z.object({
  telefone: z.string().min(8),
  motivo:   z.string().default('Bloqueado pelo atendente'),
})

export async function GET(): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }
  const repo = new BlacklistRepository(session.user.tenantId)
  try {
    const list = await repo.findAll()
    return NextResponse.json({ success: true, data: list })
  } catch (err) {
    console.error('[/api/blacklist GET]', err)
    return NextResponse.json({ success: false, error: 'Erro ao buscar blacklist' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = AddSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Dados inválidos' }, { status: 422 })
  }

  const repo = new BlacklistRepository(session.user.tenantId)
  try {
    await repo.add(parsed.data.telefone, parsed.data.motivo, session.user.id)
    return NextResponse.json({
      success: true,
      message: `${parsed.data.telefone} adicionado à blacklist`,
    }, { status: 201 })
  } catch (err) {
    console.error('[/api/blacklist POST]', err)
    return NextResponse.json({ success: false, error: 'Erro ao gravar blacklist' }, { status: 500 })
  }
}
