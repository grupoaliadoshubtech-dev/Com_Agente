import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ConhecimentoRepository } from '@/lib/repositories/conhecimento.repository'
import type { ApiResponse } from '@/types'

type Ctx = { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Ctx): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }
  const role = session.user.role as string
  if (role !== 'supervisor' && role !== 'master') {
    return NextResponse.json({ success: false, error: 'Acesso restrito ao supervisor' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) {
    return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
  }

  let body: { pergunta?: string; resposta?: string; categoria?: string; isActive?: boolean }
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const repo = new ConhecimentoRepository(session.user.tenantId)
  try {
    await repo.update(id, body)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[/api/knowledge/[id] PATCH]', err)
    return NextResponse.json({ success: false, error: 'Erro ao atualizar item' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }
  const role = session.user.role as string
  if (role !== 'supervisor' && role !== 'master') {
    return NextResponse.json({ success: false, error: 'Acesso restrito ao supervisor' }, { status: 403 })
  }

  const id = parseInt(params.id)
  if (isNaN(id)) {
    return NextResponse.json({ success: false, error: 'ID inválido' }, { status: 400 })
  }

  const repo = new ConhecimentoRepository(session.user.tenantId)
  try {
    await repo.delete(id)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[/api/knowledge/[id] DELETE]', err)
    return NextResponse.json({ success: false, error: 'Erro ao excluir item' }, { status: 500 })
  }
}
