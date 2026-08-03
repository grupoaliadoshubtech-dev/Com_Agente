import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { HandoffRepository } from '@/lib/repositories/handoff.repository'
import { TenantsRepository } from '@/lib/repositories/plans-tenants-leads.repository'
import { readRange, rowsToObjects } from '@/lib/sheets/client'
import type { ApiResponse } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }
  try {
    const tenantId = session.user.tenantId
    const tenant = await new TenantsRepository().findById(tenantId)
    const spreadsheetId = tenant?.spreadsheetId || tenantId
    console.log('[queue] tenantId:', tenantId, '| spreadsheetId:', spreadsheetId, '| tenant found:', !!tenant)
    const handoff = new HandoffRepository(spreadsheetId)
    const filaItems = await handoff.getAll()
    console.log('[queue] filaItems:', filaItems.length, filaItems.map(f => f.telefone))
    let atendimentos: Record<string, string>[] = []
    try { const rows = await readRange(spreadsheetId, 'Atendimentos!A:H'); atendimentos = rowsToObjects<Record<string, string>>(rows) } catch {}
    let clientes: Record<string, string>[] = []
    try { const rows = await readRange(spreadsheetId, 'Clientes!A:D'); clientes = rowsToObjects<Record<string, string>>(rows) } catch {}
    const queueMap = new Map()
    for (const item of filaItems) {
      if (item.telefone === 'ALL') continue
      const existing = queueMap.get(item.telefone)
      if (!existing || new Date(item.timestamp) > new Date(existing.timestamp)) {
        const cliente = clientes.find(c => (c.telefone ?? c.Telefone) === item.telefone)
        const atd = atendimentos.find(a => (a.telefone ?? a.Telefone) === item.telefone)
        queueMap.set(item.telefone, { telefone: item.telefone, nome: cliente?.nome ?? cliente?.Nome ?? atd?.nome ?? atd?.Nome ?? item.telefone, preview: atd?.preview ?? (item.status === 'pausado' ? 'Aguardando atendente' : 'Atendido por IA'), timestamp: item.timestamp, iaStatus: item.status, atendente: item.atendente })
      }
    }
    const recentAtd = atendimentos.slice(-30).reverse()
    for (const atd of recentAtd) {
      const phone = atd.telefone ?? atd.Telefone ?? ''
      if (!phone || queueMap.has(phone)) continue
      const cliente = clientes.find(c => (c.telefone ?? c.Telefone) === phone)
      queueMap.set(phone, { telefone: phone, nome: cliente?.nome ?? cliente?.Nome ?? atd.nome ?? atd.Nome ?? phone, preview: atd.preview ?? 'Atendimento recente', timestamp: atd.inicio ?? new Date().toISOString(), iaStatus: 'ativo', atendente: atd.atendente ?? 'Bot' })
    }
    return NextResponse.json({ success: true, data: Array.from(queueMap.values()).slice(0, 50) })
  } catch (err) { console.error('[/api/workspace/queue]', err); return NextResponse.json({ success: false, error: 'Erro ao buscar fila' }, { status: 500 }) }
}
