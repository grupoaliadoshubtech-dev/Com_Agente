// app/api/handoff/route.ts
// POST /api/handoff — pausa / retoma IA via tabela fila_humana no Supabase

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { HandoffRepository } from '@/lib/repositories/handoff.repository'
import { TenantsRepository } from '@/lib/repositories/plans-tenants-leads.repository'
import { z } from 'zod'
import type { ApiResponse } from '@/types'

const HandoffSchema = z.object({
  action:   z.enum(['pausar', 'retomar', 'pausa_global', 'retornar_global']),
  telefone: z.string().optional(),
})

async function resolveSchema(tenantId: string): Promise<string | null> {
  const tenant = await new TenantsRepository().findById(tenantId)
  return tenant?.supabaseSchema || null
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

  const parsed = HandoffSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Dados inválidos' }, { status: 422 })
  }

  const { action, telefone } = parsed.data
  const atendenteId = `ComAgente - ${session.user.name}`

  const schema = await resolveSchema(session.user.tenantId)
  if (!schema) {
    return NextResponse.json({ success: false, error: 'Schema do tenant não configurado.' }, { status: 400 })
  }

  const repo = new HandoffRepository(schema)

  try {
    switch (action) {
      case 'pausar':
        if (!telefone) return NextResponse.json({ success: false, error: 'telefone obrigatório para pausar' }, { status: 422 })
        await repo.pausar(telefone, atendenteId)
        return NextResponse.json({ success: true, message: `IA pausada para ${telefone}`, data: { telefone, status: 'pausado', atendente: atendenteId, timestamp: new Date().toISOString() } })

      case 'retomar':
        if (!telefone) return NextResponse.json({ success: false, error: 'telefone obrigatório para retomar' }, { status: 422 })
        await repo.retomar(telefone)
        return NextResponse.json({ success: true, message: `IA retomada para ${telefone}`, data: { telefone, status: 'ativo', atendente: atendenteId, timestamp: new Date().toISOString() } })

      case 'pausa_global':
        await repo.pausaGlobal(atendenteId)
        return NextResponse.json({ success: true, message: 'Pausa Global acionada — IA pausada para TODOS', data: { telefone: 'ALL', status: 'pausado', atendente: atendenteId, timestamp: new Date().toISOString() } })

      case 'retornar_global':
        await repo.retomar('ALL')
        return NextResponse.json({ success: true, message: 'Pausa Global removida — IA reativada para TODOS', data: { telefone: 'ALL', status: 'ativo', atendente: atendenteId, timestamp: new Date().toISOString() } })
    }
  } catch (err) {
    console.error('[/api/handoff]', err)
    return NextResponse.json({ success: false, error: 'Erro ao gravar no banco. Tente novamente.' }, { status: 500 })
  }
}

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  const telefone = req.nextUrl.searchParams.get('telefone')
  const schema   = await resolveSchema(session.user.tenantId)
  if (!schema) return NextResponse.json({ success: false, error: 'Schema não configurado' }, { status: 400 })

  const repo = new HandoffRepository(schema)
  try {
    if (telefone) {
      const status = await repo.getStatus(telefone)
      return NextResponse.json({ success: true, data: { telefone, status } })
    }
    const all = await repo.getAll()
    return NextResponse.json({ success: true, data: all })
  } catch (err) {
    console.error('[/api/handoff GET]', err)
    return NextResponse.json({ success: false, error: 'Erro ao ler banco' }, { status: 500 })
  }
}
