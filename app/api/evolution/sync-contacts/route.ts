// app/api/evolution/sync-contacts/route.ts
// POST — força busca de todos os contatos na Evolution API e retorna total + amostra
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EvolutionClient } from '@/lib/evolution/client'
import { TenantsRepository } from '@/lib/repositories/plans-tenants-leads.repository'

export const dynamic = 'force-dynamic'

const tenantsRepo = new TenantsRepository()

export async function POST(): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.tenantId) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const tenant = await tenantsRepo.findById(session.user.tenantId)
    if (!tenant?.evolutionInstance) {
      return NextResponse.json({ success: false, error: 'Instância não configurada' }, { status: 404 })
    }

    const client = new EvolutionClient({
      baseUrl:      process.env.EVOLUTION_API_URL ?? '',
      apiKey:       process.env.EVOLUTION_API_KEY ?? '',
      instanceName: tenant.evolutionInstance,
    })

    const contacts = await client.findContacts({})

    const withName = contacts.filter(c => c.pushName && c.pushName.trim() !== '')
    const sample   = withName.slice(0, 5).map(c => ({ id: c.id, pushName: c.pushName }))

    return NextResponse.json({
      success:    true,
      total:      contacts.length,
      withName:   withName.length,
      semNome:    contacts.length - withName.length,
      amostra:    sample,
    })
  } catch (err) {
    console.error('[sync-contacts]', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
