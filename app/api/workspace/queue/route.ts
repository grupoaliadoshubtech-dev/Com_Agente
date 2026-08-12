import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { HandoffRepository } from '@/lib/repositories/handoff.repository'
import { ClientesRepository } from '@/lib/repositories/clientes.repository'
import { TenantsRepository } from '@/lib/repositories/plans-tenants-leads.repository'
import type { ApiResponse } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Nao autorizado' }, { status: 401 })
  }
  try {
    const tenant = await new TenantsRepository().findById(session.user.tenantId)
    const schema = tenant?.supabaseSchema
    if (!schema) return NextResponse.json({ success: false, error: 'Schema do tenant não configurado' }, { status: 400 })

    const handoff = new HandoffRepository(schema)
    const filaItems = await handoff.getAll()

    const clientesRepo = new ClientesRepository(schema)
    const clienteNames = await clientesRepo.buildNameMap()

    const queueMap = new Map<string, Record<string, unknown>>()
    for (const item of filaItems) {
      if (item.telefone === 'ALL') continue
      const existing = queueMap.get(item.telefone)
      if (!existing || new Date(item.timestamp) > new Date(existing.timestamp as string)) {
        queueMap.set(item.telefone, {
          telefone:  item.telefone,
          nome:      clienteNames.get(item.telefone) ?? item.telefone,
          preview:   item.status === 'pausado' ? 'Aguardando atendente' : 'Atendido por IA',
          timestamp: item.timestamp,
          iaStatus:  item.status,
          atendente: item.atendente,
        })
      }
    }

    return NextResponse.json({ success: true, data: Array.from(queueMap.values()).slice(0, 50) })
  } catch (err) {
    console.error('[/api/workspace/queue]', err)
    return NextResponse.json({ success: false, error: 'Erro ao buscar fila' }, { status: 500 })
  }
}
