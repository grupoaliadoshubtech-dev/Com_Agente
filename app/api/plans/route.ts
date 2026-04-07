// ─────────────────────────────────────────────────────────────
// app/api/plans/route.ts
// GET /api/plans  — público, usado na tela de Cadastre-se
// POST /api/plans — master only, cria plano
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { PlansRepository } from '@/lib/repositories/plans-tenants-leads.repository'
import type { ApiResponse } from '@/types'

const repo = new PlansRepository()

export async function GET(): Promise<NextResponse<ApiResponse>> {
  try {
    const plans = await repo.findAll()
    return NextResponse.json({ success: true, data: plans })
  } catch (err) {
    console.error('[/api/plans GET]', err)
    return NextResponse.json({ success: false, error: 'Erro ao buscar planos' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'master') {
    return NextResponse.json({ success: false, error: 'Apenas Master Admin' }, { status: 403 })
  }
  try {
    const body = await req.json()
    const plan = await repo.create(body)
    return NextResponse.json({ success: true, data: plan }, { status: 201 })
  } catch (err) {
    console.error('[/api/plans POST]', err)
    return NextResponse.json({ success: false, error: 'Erro ao criar plano' }, { status: 500 })
  }
}
