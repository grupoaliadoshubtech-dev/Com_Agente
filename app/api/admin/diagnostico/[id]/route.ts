// ─────────────────────────────────────────────────────────────
// app/api/admin/diagnostico/[id]/route.ts  — master only
// GET → retorna diagnóstico por id (com respostas)
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { DiagnosticoRepository } from '@/lib/repositories/diagnostico.repository'
import type { ApiResponse } from '@/types'

type Ctx = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Ctx): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'master') {
    return NextResponse.json({ success: false, error: 'Apenas Master Admin' }, { status: 403 })
  }
  try {
    const all  = await new DiagnosticoRepository().findAll()
    const diag = all.find(d => d.id === params.id)
    if (!diag) return NextResponse.json({ success: false, error: 'Diagnóstico não encontrado' }, { status: 404 })
    return NextResponse.json({ success: true, data: diag })
  } catch (err) {
    console.error('[GET /api/admin/diagnostico/[id]]', err)
    return NextResponse.json({ success: false, error: 'Erro interno' }, { status: 500 })
  }
}
