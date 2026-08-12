// app/api/agendamentos/route.ts
// GET /api/agendamentos — retorna todos os registros da aba Agendamentos do tenant

import { NextResponse }             from 'next/server'
import { getServerSession }         from 'next-auth'
import { authOptions }              from '@/lib/auth'
import { TenantsRepository }        from '@/lib/repositories/plans-tenants-leads.repository'
import { AgendamentosRepository }   from '@/lib/repositories/agendamentos.repository'

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autenticado' }, { status: 401 })
  }

  const { role, tenantId, canViewAgendamentos } = session.user

  // Supervisor e master sempre têm acesso; atendentes precisam do toggle
  if (role !== 'supervisor' && role !== 'master' && !canViewAgendamentos) {
    return NextResponse.json({ success: false, error: 'Acesso negado' }, { status: 403 })
  }

  try {
    const tenantsRepo = new TenantsRepository()
    const tenant      = await tenantsRepo.findById(tenantId)
    const schema      = tenant?.supabaseSchema
    if (!schema) return NextResponse.json({ success: false, error: 'Schema do tenant não configurado' }, { status: 400 })

    const repo = new AgendamentosRepository(schema)
    const data = await repo.findAll()

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[/api/agendamentos GET]', err)
    return NextResponse.json({ success: false, error: 'Erro ao carregar agendamentos' }, { status: 500 })
  }
}
