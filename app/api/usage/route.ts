// app/api/usage/route.ts
// GET — retorna o uso mensal de mensagens do tenant logado.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getUsage } from '@/lib/evolution/message-limiter'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const usage = await getUsage(session.user.tenantId)
    return NextResponse.json({ success: true, data: usage })
  } catch (err) {
    console.error('[/api/usage]', err)
    return NextResponse.json({ success: false, error: 'Erro ao buscar uso' }, { status: 500 })
  }
}
