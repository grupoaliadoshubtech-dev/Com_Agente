import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { TenantsRepository } from '@/lib/repositories/plans-tenants-leads.repository'
import { AtendimentosRepository } from '@/lib/repositories/analytics.repository'
import type { ApiResponse } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }
  const telefone = req.nextUrl.searchParams.get('telefone')
  if (!telefone) {
    return NextResponse.json({ success: false, error: 'telefone obrigatorio' }, { status: 400 })
  }
  try {
    const tenant = await new TenantsRepository().findById(session.user.tenantId)
    const schema = tenant?.supabaseSchema
    let messages: Array<{ type: string; text: string; time: string }> = []
    if (schema) {
      try {
        const records = await new AtendimentosRepository(schema).findByPhone(telefone)
        messages = records.map(r => {
          const isBot = !r.atendente || r.atendente === 'Bot'
          const time  = r.inicio ? new Date(r.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'
          return { type: isBot ? 'bot' : 'human', text: r.duracao ?? '...', time }
        })
      } catch {}
    }
    return NextResponse.json({ success: true, data: messages })
  } catch (err) {
    console.error('[/api/workspace/messages]', err)
    return NextResponse.json({ success: false, error: 'Erro' }, { status: 500 })
  }
}
