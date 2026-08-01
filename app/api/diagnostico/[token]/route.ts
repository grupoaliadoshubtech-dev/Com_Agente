// ─────────────────────────────────────────────────────────────
// app/api/diagnostico/[token]/route.ts  — público
// GET  → verifica token, retorna leadId + status
// POST → salva respostas do formulário
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { DiagnosticoRepository } from '@/lib/repositories/diagnostico.repository'
import { LeadsRepository } from '@/lib/repositories/plans-tenants-leads.repository'
import type { ApiResponse } from '@/types'

type Ctx = { params: { token: string } }

export async function GET(_req: NextRequest, { params }: Ctx): Promise<NextResponse<ApiResponse>> {
  const { token } = params
  try {
    const repo = new DiagnosticoRepository()
    const diag = await repo.findByToken(token)
    if (!diag) {
      return NextResponse.json({ success: false, error: 'Link inválido ou expirado.' }, { status: 404 })
    }
    const leadsRepo = new LeadsRepository()
    const leads     = await leadsRepo.findAll()
    const lead      = leads.find(l => l.id === diag.leadId)
    return NextResponse.json({
      success: true,
      data: {
        status:  diag.status,
        name:    lead?.name    ?? '',
        company: lead?.company ?? '',
      },
    })
  } catch (err) {
    console.error('[GET /api/diagnostico]', err)
    return NextResponse.json({ success: false, error: 'Erro interno.' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: Ctx): Promise<NextResponse<ApiResponse>> {
  const { token } = params
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Body inválido.' }, { status: 400 })
  }
  const responses = (body as { responses?: Record<string, string> })?.responses
  if (!responses || typeof responses !== 'object') {
    return NextResponse.json({ success: false, error: 'Respostas inválidas.' }, { status: 422 })
  }
  try {
    const repo = new DiagnosticoRepository()
    const ok   = await repo.saveResponses(token, responses)
    if (!ok) {
      return NextResponse.json({ success: false, error: 'Link inválido ou já respondido.' }, { status: 404 })
    }
    return NextResponse.json({ success: true, message: 'Diagnóstico salvo com sucesso.' })
  } catch (err) {
    console.error('[POST /api/diagnostico]', err)
    return NextResponse.json({ success: false, error: 'Erro interno.' }, { status: 500 })
  }
}
