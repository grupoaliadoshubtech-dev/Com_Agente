// app/api/dashboard/route.ts
// GET /api/dashboard — métricas agregadas para o dashboard.
// Lê Atendimentos + Satisfacao do Sheets do tenant.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AtendimentosRepository } from '@/lib/repositories/analytics.repository'
import { SatisfacaoRepository }   from '@/lib/repositories/analytics.repository'
import type { ApiResponse } from '@/types'

export async function GET(): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  // Atendente sem toggle de dashboard → 403
  if (session.user.role === 'atendente' && !session.user.canViewDashboard) {
    return NextResponse.json({ success: false, error: 'Acesso não liberado pelo supervisor' }, { status: 403 })
  }

  try {
    const tid   = session.user.tenantId
    const [atdMetrics, satMetrics] = await Promise.all([
      new AtendimentosRepository(tid).getMetrics(),
      new SatisfacaoRepository(tid).getMetrics(),
    ])

    return NextResponse.json({
      success: true,
      data: { atendimentos: atdMetrics, satisfacao: satMetrics },
    })
  } catch (err) {
    console.error('[/api/dashboard]', err)
    return NextResponse.json({ success: false, error: 'Erro ao buscar métricas' }, { status: 500 })
  }
}
