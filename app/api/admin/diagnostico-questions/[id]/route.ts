// ─────────────────────────────────────────────────────────────
// app/api/admin/diagnostico-questions/[id]/route.ts  — master only
// PATCH  → edita pergunta
// DELETE → exclui pergunta
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { DiagnosticoQuestionsRepository } from '@/lib/repositories/diagnostico-questions.repository'
import type { ApiResponse } from '@/types'

type Ctx = { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Ctx): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'master') {
    return NextResponse.json({ success: false, error: 'Apenas Master Admin' }, { status: 403 })
  }
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }
  const { question, sectionTitle, sectionSubtitle, sectionIndex, questionIndex } =
    body as Partial<{ question: string; sectionTitle: string; sectionSubtitle: string; sectionIndex: number; questionIndex: number }>
  try {
    const repo = new DiagnosticoQuestionsRepository()
    const ok   = await repo.updateById(params.id, { question, sectionTitle, sectionSubtitle, sectionIndex, questionIndex })
    if (!ok) return NextResponse.json({ success: false, error: 'Pergunta não encontrada' }, { status: 404 })
    return NextResponse.json({ success: true, message: 'Pergunta atualizada.' })
  } catch (err) {
    console.error('[PATCH /api/admin/diagnostico-questions/[id]]', err)
    return NextResponse.json({ success: false, error: 'Erro ao atualizar' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'master') {
    return NextResponse.json({ success: false, error: 'Apenas Master Admin' }, { status: 403 })
  }
  try {
    const repo = new DiagnosticoQuestionsRepository()
    const ok   = await repo.deleteById(params.id)
    if (!ok) return NextResponse.json({ success: false, error: 'Pergunta não encontrada' }, { status: 404 })
    return NextResponse.json({ success: true, message: 'Pergunta excluída.' })
  } catch (err) {
    console.error('[DELETE /api/admin/diagnostico-questions/[id]]', err)
    return NextResponse.json({ success: false, error: 'Erro ao excluir' }, { status: 500 })
  }
}
