// app/api/evolution/profile-pic/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EvolutionClient } from '@/lib/evolution/client'
import { TenantsRepository } from '@/lib/repositories/plans-tenants-leads.repository'

export const dynamic = 'force-dynamic'

const tenantsRepo = new TenantsRepository()

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.tenantId) return NextResponse.json({ url: null }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const number = searchParams.get('number')
    if (!number) return NextResponse.json({ url: null }, { status: 400 })

    const tenant = await tenantsRepo.findById(session.user.tenantId)
    if (!tenant) return NextResponse.json({ url: null }, { status: 404 })

    const client = new EvolutionClient({
      baseUrl:      process.env.EVOLUTION_API_URL ?? '',
      apiKey:       process.env.EVOLUTION_API_KEY ?? '',
      instanceName: tenant.evolutionInstance ?? '',
    })

    const info = await client.getContactInfo(number)
    return NextResponse.json({ url: info.profilePictureUrl ?? null })
  } catch {
    return NextResponse.json({ url: null })
  }
}
