import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { TenantsRepository } from '@/lib/repositories/plans-tenants-leads.repository'

export const dynamic = 'force-dynamic'

const tenantsRepo = new TenantsRepository()

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  const tenant = await tenantsRepo.findById(session.user.tenantId)
  const instanceName = (tenant as { evolutionInstance?: string } | null)?.evolutionInstance ?? ''

  return NextResponse.json({ success: true, instanceName })
}
