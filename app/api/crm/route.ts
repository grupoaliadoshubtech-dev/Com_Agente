// app/api/crm/route.ts
// FASE 4: GET (lista/filtros), PUT (update de cliente), POST (disparo em lote)

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ClientesRepository } from '@/lib/repositories/analytics.repository'
import { EvolutionClient, normalizeNumber } from '@/lib/evolution/client'
import { TenantsRepository } from '@/lib/repositories/plans-tenants-leads.repository'
import type { ApiResponse, CRMStage } from '@/types'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const tenantsRepo = new TenantsRepository()

// ── GET: Listar clientes com filtros ─────────────────────────
export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  if (session.user.role === 'atendente' && !session.user.canViewCRM) {
    return NextResponse.json({ success: false, error: 'Acesso não liberado' }, { status: 403 })
  }

  try {
    const repo = new ClientesRepository(session.user.tenantId)
    const phone  = req.nextUrl.searchParams.get('telefone')
    const etapa  = req.nextUrl.searchParams.get('etapa') as CRMStage | null
    const overdue = req.nextUrl.searchParams.get('overdue')
    const metrics = req.nextUrl.searchParams.get('metrics')

    if (metrics === 'true') {
      const data = await repo.getMetrics()
      return NextResponse.json({ success: true, data })
    }
    if (phone) {
      const data = await repo.findByPhone(phone)
      return NextResponse.json({ success: true, data })
    }
    if (overdue === 'true') {
      const data = await repo.findOverdueFollowUps()
      return NextResponse.json({ success: true, data })
    }
    if (etapa) {
      const data = await repo.findByStage(etapa)
      return NextResponse.json({ success: true, data })
    }

    const data = await repo.findAll()
    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}

// ── PUT: Atualizar cliente (etapa, tags, follow-up, notas) ───
const UpdateSchema = z.object({
  telefone:        z.string().min(8),
  etapa:           z.string().optional(),
  tags:            z.string().optional(),
  proximoFollowUp: z.string().optional(),
  valorEstimado:   z.string().optional(),
  atendente:       z.string().optional(),
  notas:           z.string().optional(),
  status:          z.string().optional(),
})

export async function PUT(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  if (session.user.role === 'atendente') {
    return NextResponse.json({ success: false, error: 'Apenas supervisor ou master' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Dados inválidos' }, { status: 422 })
  }

  try {
    const repo = new ClientesRepository(session.user.tenantId)
    const { telefone, ...updates } = parsed.data

    // Adiciona timestamp do último contato automaticamente
   await repo.updateClient(telefone, {
      ...updates,
      etapa: updates.etapa as CRMStage | undefined,
      ultimoContato: new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      message: `Cliente ${telefone} atualizado`,
    })
  } catch (err) {
    console.error('[/api/crm PUT]', err)
    return NextResponse.json({ success: false, error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}

// ── POST: Disparo de mensagem em lote (follow-up) ────────────
const BulkSendSchema = z.object({
  telefones: z.array(z.string().min(8)),
  mensagem:  z.string().min(1),
})

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  if (session.user.role === 'atendente') {
    return NextResponse.json({ success: false, error: 'Apenas supervisor ou master' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = BulkSendSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Dados inválidos' }, { status: 422 })
  }

  const { telefones, mensagem } = parsed.data

  try {
    // Resolve instância do tenant
    const tenant = await tenantsRepo.findById(session.user.tenantId)
    const instanceName = tenant?.evolutionInstance
    if (!instanceName) {
      return NextResponse.json({ success: false, error: 'Instância não configurada' }, { status: 400 })
    }

    const client = EvolutionClient.fromEnv(instanceName)
    const repo = new ClientesRepository(session.user.tenantId)
    let enviados = 0
    let erros = 0

    for (const tel of telefones) {
      try {
        const number = normalizeNumber(tel)
        await client.sendTextWithTyping(number, mensagem)
        // Atualiza último contato do cliente
        await repo.updateClient(tel, {
          ultimoContato: new Date().toISOString(),
        }).catch(() => {}) // Não bloqueia se falhar
        enviados++
        // Delay entre envios para não ser bloqueado
        await new Promise(r => setTimeout(r, 2000))
      } catch {
        erros++
      }
    }

    return NextResponse.json({
      success: true,
      message: `Enviado para ${enviados} contatos${erros > 0 ? `, ${erros} erros` : ''}`,
      data: { enviados, erros, total: telefones.length },
    })
  } catch (err) {
    console.error('[/api/crm POST]', err)
    return NextResponse.json({ success: false, error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}
