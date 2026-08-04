// app/api/agendamentos/[row]/route.ts
// PATCH /api/agendamentos/:row — supervisor edita um agendamento (atualiza linha no Sheets)

import { NextRequest, NextResponse }    from 'next/server'
import { getServerSession }             from 'next-auth'
import { authOptions }                  from '@/lib/auth'
import { TenantsRepository }            from '@/lib/repositories/plans-tenants-leads.repository'
import { AgendamentosRepository }       from '@/lib/repositories/agendamentos.repository'
import { z }                            from 'zod'

const Schema = z.object({
  updates: z.record(z.string(), z.string()),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { row: string } }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autenticado' }, { status: 401 })
  }

  const { role, tenantId } = session.user
  if (role !== 'supervisor' && role !== 'master') {
    return NextResponse.json({ success: false, error: 'Apenas supervisores podem editar agendamentos' }, { status: 403 })
  }

  const rowIndex = parseInt(params.row, 10)
  if (isNaN(rowIndex) || rowIndex < 2) {
    return NextResponse.json({ success: false, error: 'Índice de linha inválido' }, { status: 400 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Dados inválidos' }, { status: 422 })
  }

  try {
    const tenantsRepo   = new TenantsRepository()
    const tenant        = await tenantsRepo.findById(tenantId)
    const spreadsheetId = tenant?.spreadsheetId || tenantId

    const repo = new AgendamentosRepository(spreadsheetId)
    await repo.update(rowIndex, parsed.data.updates)

    return NextResponse.json({ success: true, message: 'Agendamento atualizado' })
  } catch (err) {
    console.error('[/api/agendamentos PATCH]', err)
    return NextResponse.json({ success: false, error: 'Erro ao salvar' }, { status: 500 })
  }
}
