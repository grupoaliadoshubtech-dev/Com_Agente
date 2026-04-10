import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { readRange, rowsToObjects } from '@/lib/sheets/client'
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
    const tenantId = session.user.tenantId
    let messages: Array<{ type: string; text: string; time: string }> = []
    try {
      const rows = await readRange(tenantId, 'Atendimentos!A:H')
      const records = rowsToObjects<Record<string, string>>(rows)
      const filtered = records.filter(r => (r.telefone ?? r.Telefone) === telefone)
      messages = filtered.map(r => {
        const atendente = r.atendente ?? r.Atendente ?? 'Bot'
        const isBot = atendente === 'Bot'
        const inicio = r.inicio ?? r.Inicio ?? ''
        const time = inicio ? new Date(inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--:--'
        return { type: isBot ? 'bot' : 'human', text: r.preview ?? '...', time }
      })
    } catch {}
    return NextResponse.json({ success: true, data: messages })
  } catch (err) { console.error('[/api/workspace/messages]', err); return NextResponse.json({ success: false, error: 'Erro' }, { status: 500 }) }
}
