// app/api/distribution/route.ts
// FASE 6 — API de distribuição automática
// GET: métricas e lista | PUT: toggle online/config | POST: sync com usuarios

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { DistributionRepository } from '@/lib/repositories/distribution.repository'
import { z } from 'zod'
import type { ApiResponse } from '@/types'

export const dynamic = 'force-dynamic'

// ── GET: Métricas e lista de atendentes ──────────────────────
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const repo = new DistributionRepository(session.user.tenantId)
    const view = req.nextUrl.searchParams.get('view')

    if (view === 'metrics') {
      const metrics = await repo.getMetrics()
      return NextResponse.json({ success: true, data: metrics })
    }

    const all = await repo.findAll()
    return NextResponse.json({ success: true, data: all })
  } catch (err) {
    console.error('[/api/distribution GET]', err)
    return NextResponse.json({ success: false, error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}

// ── PUT: Atualizar status e configuração ─────────────────────
const UpdateSchema = z.object({
  atendenteId:   z.string().min(1),
  action:        z.enum(['toggle_online', 'update_config', 'liberar']),
  online:        z.boolean().optional(),
  especialidade: z.string().optional(),
  maxConversas:  z.number().min(1).max(20).optional(),
})

export async function PUT(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  // Atendentes só podem mudar seu próprio status online
  const isManager = session.user.role === 'supervisor' || session.user.role === 'master'

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Dados inválidos' }, { status: 422 })
  }

  const { atendenteId, action, online, especialidade, maxConversas } = parsed.data

  // Atendente só pode alterar a si mesmo
  if (!isManager && atendenteId !== session.user.id) {
    return NextResponse.json({ success: false, error: 'Sem permissão' }, { status: 403 })
  }

  try {
    const repo = new DistributionRepository(session.user.tenantId)

    switch (action) {
      case 'toggle_online':
        if (online === undefined) {
          return NextResponse.json({ success: false, error: 'online obrigatório' }, { status: 422 })
        }
        await repo.setOnline(atendenteId, online)
        return NextResponse.json({
          success: true,
          message: online ? 'Atendente online' : 'Atendente offline',
        })

      case 'update_config':
        if (!isManager) {
          return NextResponse.json({ success: false, error: 'Apenas supervisor' }, { status: 403 })
        }
        await repo.updateConfig(atendenteId, { especialidade, maxConversas })
        return NextResponse.json({ success: true, message: 'Configuração atualizada' })

      case 'liberar':
        await repo.liberar(atendenteId)
        return NextResponse.json({ success: true, message: 'Conversa liberada' })

      default:
        return NextResponse.json({ success: false, error: 'Ação inválida' }, { status: 400 })
    }
  } catch (err) {
    console.error('[/api/distribution PUT]', err)
    return NextResponse.json({ success: false, error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}

// ── POST: Sincronizar atendentes da aba Usuarios ─────────────
export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }
  if (session.user.role === 'atendente') {
    return NextResponse.json({ success: false, error: 'Apenas supervisor ou master' }, { status: 403 })
  }

  try {
    const repo = new DistributionRepository(session.user.tenantId)
    await repo.syncFromUsers()
    const all = await repo.findAll()
    return NextResponse.json({
      success: true,
      message: `${all.length} atendentes sincronizados`,
      data: all,
    })
  } catch (err) {
    console.error('[/api/distribution POST]', err)
    return NextResponse.json({ success: false, error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}
