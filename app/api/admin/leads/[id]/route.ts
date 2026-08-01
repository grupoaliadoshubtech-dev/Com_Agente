// ─────────────────────────────────────────────────────────────
// app/api/admin/leads/[id]/route.ts  — master only
// PATCH → atualiza campos do lead
// POST  → reenvia e-mail de diagnóstico
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { LeadsRepository } from '@/lib/repositories/plans-tenants-leads.repository'
import { DiagnosticoRepository } from '@/lib/repositories/diagnostico.repository'
import { sendMail, diagnosticoTemplate } from '@/lib/email/mailer'
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

export async function POST(_req: NextRequest, { params }: Ctx): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'master') {
    return NextResponse.json({ success: false, error: 'Apenas Master Admin' }, { status: 403 })
  }
  try {
    const lead = await new LeadsRepository().findById(params.id)
    if (!lead) return NextResponse.json({ success: false, error: 'Lead não encontrado' }, { status: 404 })

    const diag = await new DiagnosticoRepository().findByLeadId(params.id)
    if (!diag) return NextResponse.json({ success: false, error: 'Diagnóstico não encontrado para este lead' }, { status: 404 })

    const origin  = process.env.NEXTAUTH_URL ?? 'https://comagente.gaht.com.br'
    const diagUrl = `${origin}/diagnostico/${diag.token}`

    await sendMail({
      to:      lead.email,
      subject: 'Diagnóstico do seu Atendimento — ComAgente',
      html:    diagnosticoTemplate(lead.name, lead.company, diagUrl),
    })

    return NextResponse.json({ success: true, message: 'E-mail de diagnóstico reenviado.' })
  } catch (err) {
    console.error('[POST /api/admin/leads/[id]]', err)
    return NextResponse.json({ success: false, error: 'Erro ao reenviar e-mail' }, { status: 500 })
  }
}
