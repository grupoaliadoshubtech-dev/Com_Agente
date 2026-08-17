import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ConhecimentoRepository } from '@/lib/repositories/conhecimento.repository'
import type { ApiResponse } from '@/types'

export async function GET(): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }
  const repo = new ConhecimentoRepository(session.user.tenantId)
  try {
    const data = await repo.findAll()
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[/api/knowledge GET]', err)
    return NextResponse.json({ success: false, error: 'Erro ao buscar conhecimento' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }
  const role = session.user.role as string
  if (role !== 'supervisor' && role !== 'master') {
    return NextResponse.json({ success: false, error: 'Acesso restrito ao supervisor' }, { status: 403 })
  }

  let body: { pergunta?: string; resposta?: string; categoria?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  if (!body.pergunta?.trim() || !body.resposta?.trim()) {
    return NextResponse.json({ success: false, error: 'Pergunta e resposta são obrigatórias' }, { status: 422 })
  }

  const repo = new ConhecimentoRepository(session.user.tenantId)
  try {
    const item = await repo.create(body.pergunta, body.resposta, body.categoria ?? 'geral')
    return NextResponse.json({ success: true, data: item }, { status: 201 })
  } catch (err) {
    console.error('[/api/knowledge POST]', err)
    return NextResponse.json({ success: false, error: 'Erro ao criar item' }, { status: 500 })
  }
}
