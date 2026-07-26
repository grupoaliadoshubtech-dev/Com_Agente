// app/api/satisfacao/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { SatisfacaoRepository } from '@/lib/repositories/analytics.repository'
import type { ApiResponse } from '@/types'

export async function GET(): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  if (session.user.role === 'atendente' && !session.user.canViewSatisfacao) {
    return NextResponse.json({ success: false, error: 'Acesso não liberado' }, { status: 403 })
  }
  try {
    const repo = new SatisfacaoRepository(session.user.tenantId)
    const [all, metrics] = await Promise.all([repo.findAll(), repo.getMetrics()])
    return NextResponse.json({ success: true, data: { records: all, metrics } })
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}
