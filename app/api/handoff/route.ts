// ─────────────────────────────────────────────────────────────
// app/api/handoff/route.ts
//
// POST /api/handoff
// Corpo: { action: 'pausar' | 'retomar' | 'pausa_global' | 'retornar_global', telefone?: string }
//
// Grava na aba Fila_Humana do tenant com exatamente 4 colunas:
//   A: Telefone | B: Status | C: Timestamp ISO | D: Atendente
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { HandoffRepository } from '@/lib/repositories/handoff.repository'
import { z } from 'zod'
import type { ApiResponse } from '@/types'

const HandoffSchema = z.object({
  action:   z.enum(['pausar', 'retomar', 'pausa_global', 'retornar_global']),
  telefone: z.string().optional(),
})

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  // 1. Autenticação
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  // 2. Validação do corpo
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = HandoffSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten().fieldErrors.toString() },
      { status: 422 }
    )
  }

  const { action, telefone } = parsed.data
  const atendenteId = `ComAgente - ${session.user.name}`
  const tenantId    = session.user.tenantId

  if (!tenantId) {
    return NextResponse.json({ success: false, error: 'tenantId ausente na sessão' }, { status: 400 })
  }

  // 3. Executa ação no repositório
  const repo = new HandoffRepository(tenantId)

  try {
    switch (action) {
      case 'pausar':
        if (!telefone) {
          return NextResponse.json({ success: false, error: 'telefone obrigatório para pausar' }, { status: 422 })
        }
        await repo.pausar(telefone, atendenteId)
        return NextResponse.json({
          success: true,
          message: `IA pausada para ${telefone}`,
          data: { telefone, status: 'pausado', atendente: atendenteId, timestamp: new Date().toISOString() }
        })

      case 'retomar':
        if (!telefone) {
          return NextResponse.json({ success: false, error: 'telefone obrigatório para retomar' }, { status: 422 })
        }
        await repo.retomar(telefone)
        return NextResponse.json({
          success: true,
          message: `IA retomada para ${telefone}`,
          data: { telefone, status: 'ativo', atendente: atendenteId, timestamp: new Date().toISOString() }
        })

      case 'pausa_global':
        await repo.pausaGlobal(atendenteId)
        return NextResponse.json({
          success: true,
          message: 'Pausa Global acionada — IA pausada para TODOS',
          data: { telefone: 'ALL', status: 'pausado', atendente: atendenteId, timestamp: new Date().toISOString() }
        })

      case 'retornar_global':
        await repo.retomar('ALL')
        return NextResponse.json({
          success: true,
          message: 'Pausa Global removida — IA reativada para TODOS',
          data: { telefone: 'ALL', status: 'ativo', atendente: atendenteId, timestamp: new Date().toISOString() }
        })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[/api/handoff]', msg)

    let userMsg = 'Erro ao gravar na planilha. Tente novamente.'
    if (msg.includes('Requested entity was not found'))
      userMsg = 'Planilha desta empresa não encontrada. Configure o ID da planilha nas configurações da empresa.'
    else if (msg.includes('PERMISSION_DENIED') || msg.toLowerCase().includes('permission'))
      userMsg = 'Sem permissão de acesso à planilha. Verifique se a service account tem acesso.'
    else if (msg.includes('RESOURCE_EXHAUSTED') || msg.toLowerCase().includes('quota'))
      userMsg = 'Limite de requisições do Google atingido. Aguarde alguns segundos e tente novamente.'
    else if (msg.includes('Unable to parse range'))
      userMsg = 'Aba "Fila_Humana" não encontrada na planilha desta empresa.'

    return NextResponse.json(
      { success: false, error: userMsg },
      { status: 500 }
    )
  }
}

// GET /api/handoff?telefone=55719...
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  const telefone = req.nextUrl.searchParams.get('telefone')
  const repo     = new HandoffRepository(session.user.tenantId)

  try {
    if (telefone) {
      const status = await repo.getStatus(telefone)
      return NextResponse.json({ success: true, data: { telefone, status } })
    }
    const all = await repo.getAll()
    return NextResponse.json({ success: true, data: all })
  } catch (err) {
    console.error('[/api/handoff GET]', err)
    return NextResponse.json({ success: false, error: 'Erro ao ler planilha' }, { status: 500 })
  }
}
