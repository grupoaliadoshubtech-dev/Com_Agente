// ─────────────────────────────────────────────────────────────
// app/api/admin/leads-com-diagnostico/route.ts  — master only
// Combina leads + status do diagnóstico em um único array
// ─────────────────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { LeadsRepository } from '@/lib/repositories/plans-tenants-leads.repository'
import { DiagnosticoRepository } from '@/lib/repositories/diagnostico.repository'
import type { ApiResponse } from '@/types'

export async function GET(): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'master') {
    return NextResponse.json({ success: false, error: 'Apenas Master Admin' }, { status: 403 })
  }
  try {
    const [leads, diags] = await Promise.all([
      new LeadsRepository().findAll(),
      new DiagnosticoRepository().findAll(),
    ])

    const diagByLead = Object.fromEntries(diags.map(d => [d.leadId, d]))

    const data = leads.map(lead => ({
      ...lead,
      diagnostico: diagByLead[lead.id]
        ? {
            id:          diagByLead[lead.id].id,
            token:       diagByLead[lead.id].token,
            status:      diagByLead[lead.id].status,
            respondedAt: diagByLead[lead.id].respondedAt,
          }
        : null,
    }))

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[GET /api/admin/leads-com-diagnostico]', err)
    return NextResponse.json({ success: false, error: 'Erro ao buscar dados' }, { status: 500 })
  }
}
