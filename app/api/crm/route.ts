// app/api/crm/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ClientesRepository } from '@/lib/repositories/analytics.repository'
import type { ApiResponse } from '@/types'

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  if (session.user.role === 'atendente' && !session.user.canViewCRM) {
    return NextResponse.json({ success: false, error: 'Acesso não liberado' }, { status: 403 })
  }
  try {
    const repo  = new ClientesRepository(session.user.tenantId)
    const phone = req.nextUrl.searchParams.get('telefone')
    const data  = phone ? await repo.findByPhone(phone) : await repo.findAll()
    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
