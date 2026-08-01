// ─────────────────────────────────────────────────────────────
// app/api/admin/diagnostico-questions/route.ts  — master only
// GET  → lista todas as perguntas
// POST → adiciona nova pergunta
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { DiagnosticoQuestionsRepository } from '@/lib/repositories/diagnostico-questions.repository'
import type { ApiResponse } from '@/types'

export async function GET(): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'master') {
    return NextResponse.json({ success: false, error: 'Apenas Master Admin' }, { status: 403 })
  }
  try {
    const repo = new DiagnosticoQuestionsRepository()
    const data = await repo.findAll()
    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[GET /api/admin/diagnostico-questions]', err)
    return NextResponse.json({ success: false, error: 'Erro ao buscar perguntas' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'master') {
    return NextResponse.json({ success: false, error: 'Apenas Master Admin' }, { status: 403 })
  }
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }
  const { sectionIndex, sectionTitle, sectionSubtitle, questionIndex, question } =
    body as { sectionIndex: number; sectionTitle: string; sectionSubtitle: string; questionIndex: number; question: string }
  if (!question?.trim() || !sectionTitle?.trim()) {
    return NextResponse.json({ success: false, error: 'Pergunta e título da seção são obrigatórios' }, { status: 422 })
  }
  try {
    const repo   = new DiagnosticoQuestionsRepository()
    const record = await repo.create({ sectionIndex: Number(sectionIndex), sectionTitle, sectionSubtitle: sectionSubtitle ?? '', questionIndex: Number(questionIndex), question })
    return NextResponse.json({ success: true, data: record }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/admin/diagnostico-questions]', err)
    return NextResponse.json({ success: false, error: 'Erro ao criar pergunta' }, { status: 500 })
  }
}
