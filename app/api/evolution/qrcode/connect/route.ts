// app/api/evolution/qrcode/connect/route.ts
// POST — força geração de QR Code chamando /instance/connect na Evolution API
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EvolutionClient } from '@/lib/evolution/client'
import { TenantsRepository } from '@/lib/repositories/plans-tenants-leads.repository'
import { UsersRepository } from '@/lib/repositories/users.repository'

export const dynamic = 'force-dynamic'

const tenantsRepo = new TenantsRepository()
const usersRepo   = new UsersRepository()

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user || !['supervisor', 'master'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Acesso negado' }, { status: 403 })
  }

  try {
    let tenantId = session.user.tenantId
    if (!tenantId && session.user.email) {
      const user = await usersRepo.findByEmail(session.user.email).catch(() => null)
      tenantId = user?.tenantId ?? ''
    }

    const tenant = await tenantsRepo.findById(tenantId).catch(() => null)
    const instanceName = tenant?.evolutionInstance || process.env.EVOLUTION_INSTANCE || tenantId || ''
    if (!instanceName) {
      return NextResponse.json({ success: false, error: 'Instância não configurada. Faça logout e login novamente.' }, { status: 400 })
    }

    const client = EvolutionClient.fromEnv(instanceName)
    const qr = await client.getQRCode()

    return NextResponse.json({ success: true, data: qr })
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}
