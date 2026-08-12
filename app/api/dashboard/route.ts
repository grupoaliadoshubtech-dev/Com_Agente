// app/api/dashboard/route.ts
// FASE 7 — Dashboard em tempo real.
// Agrega: Atendimentos + Satisfação + Distribuição + Chats ativos

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AtendimentosRepository, SatisfacaoRepository } from '@/lib/repositories/analytics.repository'
import { DistributionRepository } from '@/lib/repositories/distribution.repository'
import { HandoffRepository } from '@/lib/repositories/handoff.repository'
import { EvolutionClient } from '@/lib/evolution/client'
import { TenantsRepository } from '@/lib/repositories/plans-tenants-leads.repository'
import type { ApiResponse } from '@/types'

export const dynamic = 'force-dynamic'

const tenantsRepo = new TenantsRepository()

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }
  if (session.user.role === 'atendente' && !session.user.canViewDashboard) {
    return NextResponse.json({ success: false, error: 'Acesso não liberado pelo supervisor' }, { status: 403 })
  }

  const view = req.nextUrl.searchParams.get('view')

  try {
    const tenantId = session.user.tenantId
    const tenant = await tenantsRepo.findById(tenantId)
    const tid = tenant?.supabaseSchema ?? ''

    if (!tid) {
      return NextResponse.json({ success: false, error: 'Schema do tenant não configurado' }, { status: 400 })
    }

    // ── Vista rápida (polling leve — só dados em tempo real) ──
    if (view === 'realtime') {
      const [distMetrics, handoffAll] = await Promise.allSettled([
        new DistributionRepository(tid).getMetrics(),
        new HandoffRepository(tid).getAll(),
      ])

      const dist = distMetrics.status === 'fulfilled' ? distMetrics.value : null
      const handoff = handoffAll.status === 'fulfilled' ? handoffAll.value : []

      // Conta handoffs pausados ativos (não resolvidos)
      const pausados = new Map<string, boolean>()
      for (const h of handoff) {
        if (h.telefone === 'ALL') {
          // Kill switch: todos pausados
          pausados.clear()
          if (h.status === 'pausado') pausados.set('ALL', true)
        } else {
          if (h.status === 'pausado') pausados.set(h.telefone, true)
          else pausados.delete(h.telefone)
        }
      }
      const filaHumana = pausados.size

      // Conexão WhatsApp
      let whatsappStatus = 'unknown'
      try {
        if (tenant?.evolutionInstance) {
          const client = EvolutionClient.fromEnv(tenant.evolutionInstance)
          const status = await client.getStatus()
          whatsappStatus = status.instance.state
        }
      } catch {}

      return NextResponse.json({
        success: true,
        data: {
          realtime: {
            atendentesOnline:    dist?.totalOnline ?? 0,
            atendentesOffline:   dist?.totalOffline ?? 0,
            conversasAtivas:     dist?.totalConversasAtivas ?? 0,
            capacidadeUsada:     dist?.capacidadeUsada ?? 0,
            filaHumana,
            whatsappStatus,
            timestamp:           new Date().toISOString(),
          }
        }
      })
    }

    // ── Vista completa (carregamento inicial) ─────────────────
    const [atdMetrics, satMetrics, distMetrics, handoffAll] = await Promise.allSettled([
      new AtendimentosRepository(tid).getMetrics(),
      new SatisfacaoRepository(tid).getMetrics(),
      new DistributionRepository(tid).getMetrics(),
      new HandoffRepository(tid).getAll(),
    ])


    const atd  = atdMetrics.status  === 'fulfilled' ? atdMetrics.value  : null
    const sat  = satMetrics.status  === 'fulfilled' ? satMetrics.value  : null
    const dist = distMetrics.status === 'fulfilled' ? distMetrics.value : null
    const handoff = handoffAll.status === 'fulfilled' ? handoffAll.value : []

    // Fila humana
    const pausados = new Map<string, boolean>()
    for (const h of handoff) {
      if (h.telefone === 'ALL') {
        pausados.clear()
        if (h.status === 'pausado') pausados.set('ALL', true)
      } else {
        if (h.status === 'pausado') pausados.set(h.telefone, true)
        else pausados.delete(h.telefone)
      }
    }

    // Atendimentos por hora (últimas 24h)
    const porHora: Record<string, number> = {}
    if (atdMetrics.status === 'fulfilled') {
      const atdRepo = new AtendimentosRepository(tid)

      const all = await atdRepo.findAll()
      const ontem = new Date(Date.now() - 24 * 3600000).toISOString()
      for (const a of all) {
        if (a.inicio >= ontem) {
          const hora = a.inicio.slice(11, 13) + ':00'
          porHora[hora] = (porHora[hora] ?? 0) + 1
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        atendimentos: atd ?? { total: 0, hoje: 0, semana: 0, porAtendente: {}, mediaMinutos: 0, taxaHumano: 0 },
        satisfacao: sat ?? { media: 0, total: 0, distribuicao: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, tendencia: [] },
        realtime: {
          atendentesOnline:  dist?.totalOnline ?? 0,
          atendentesOffline: dist?.totalOffline ?? 0,
          conversasAtivas:   dist?.totalConversasAtivas ?? 0,
          capacidadeUsada:   dist?.capacidadeUsada ?? 0,
          filaHumana:        pausados.size,
          whatsappStatus:    'unknown',
          timestamp:         new Date().toISOString(),
        },
        distribuicao: dist?.atendentes ?? [],
        porHora,
      },
    })
  } catch (err) {
    console.error('[/api/dashboard]', err)
    return NextResponse.json({ success: false, error: 'Erro ao buscar métricas' }, { status: 500 })
  }
}
