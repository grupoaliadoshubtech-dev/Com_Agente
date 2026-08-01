// ─────────────────────────────────────────────────────────────
// app/api/admin/leads/[id]/route.ts  — master only
// PATCH → atualiza campos do lead (nome, empresa, e-mail, telefone, plano, status)
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { LeadsRepository } from '@/lib/repositories/plans-tenants-leads.repository'
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
  const { name, email, phone, company, planId, planName, status } =
    body as Partial<{ name: string; email: string; phone: string; company: string; planId: string; planName: string; status: string }>
  try {
    const repo = new LeadsRepository()
    const ok   = await repo.updateById(params.id, { name, email, phone, company, planId, planName, status: status as any })
    if (!ok) return NextResponse.json({ success: false, error: 'Lead não encontrado' }, { status: 404 })
    return NextResponse.json({ success: true, message: 'Lead atualizado com sucesso.' })
  } catch (err) {
    console.error('[PATCH /api/admin/leads/[id]]', err)
    return NextResponse.json({ success: false, error: 'Erro ao atualizar lead' }, { status: 500 })
  }
}
