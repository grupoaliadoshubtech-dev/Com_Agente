// ─────────────────────────────────────────────────────────────
// app/api/leads/route.ts
// POST /api/leads  — público, captura lead do formulário Cadastre-se
// GET  /api/leads  — master only, lista todos os leads
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { LeadsRepository, PlansRepository } from '@/lib/repositories/plans-tenants-leads.repository'
import { DiagnosticoRepository } from '@/lib/repositories/diagnostico.repository'
import { sendMail, diagnosticoTemplate } from '@/lib/email/mailer'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { z } from 'zod'
import type { ApiResponse } from '@/types'

const LeadSchema = z.object({
  name:    z.string().min(2).max(100),
  email:   z.string().email().max(200),
  phone:   z.string().min(8).max(20),
  company: z.string().min(1).max(100),
  planId:  z.string().min(1).max(100),
})

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  // 5 leads por IP a cada hora — evita spam e esgotamento de cota do Sheets
  const rl = await rateLimit(`leads:${getClientIp(req)}`, 5, 60 * 60)
  if (!rl.allowed) {
    return NextResponse.json({ success: false, error: 'Muitas tentativas. Tente novamente mais tarde.' }, { status: 429 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = LeadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Dados inválidos', data: parsed.error.flatten() },
      { status: 422 }
    )
  }

  try {
    const plansRepo = new PlansRepository()
    const plan      = await plansRepo.findById(parsed.data.planId)
    const planName  = plan?.name ?? 'Plano não encontrado'

    const leadsRepo = new LeadsRepository()
    const lead = await leadsRepo.create({ ...parsed.data, planName })

    // Diagnóstico: cria registro e envia e-mail (falha não bloqueia cadastro)
    try {
      const diagRepo   = new DiagnosticoRepository()
      const diag       = await diagRepo.create(lead.id)
      const baseUrl    = process.env.NEXTAUTH_URL ?? 'https://app.comagente.gaht.com.br'
      const diagUrl    = `${baseUrl}/diagnostico/${diag.token}`
      await sendMail({
        to:      lead.email,
        subject: 'Diagnóstico do seu Atendimento — ComAgente',
        html:    diagnosticoTemplate(lead.name, lead.company, diagUrl),
      })
    } catch (diagErr) {
      console.error('[/api/leads POST] erro ao criar diagnóstico/enviar email:', diagErr)
    }

    return NextResponse.json({
      success: true,
      message: 'Lead cadastrado com sucesso.',
      data: { id: lead.id },
    }, { status: 201 })
  } catch (err) {
    console.error('[/api/leads POST]', err)
    return NextResponse.json({ success: false, error: 'Erro ao salvar lead' }, { status: 500 })
  }
}

export async function GET(): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'master') {
    return NextResponse.json({ success: false, error: 'Apenas Master Admin' }, { status: 403 })
  }
  try {
    const repo  = new LeadsRepository()
    const leads = await repo.findAll()
    return NextResponse.json({ success: true, data: leads })
  } catch (err) {
    console.error('[/api/leads GET]', err)
    return NextResponse.json({ success: false, error: 'Erro ao buscar leads' }, { status: 500 })
  }
}
