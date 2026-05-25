// app/api/evolution/qrcode/connect/route.ts
// POST — força geração de QR Code chamando /instance/connect na Evolution API
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EvolutionClient } from '@/lib/evolution/client'
import { TenantsRepository } from '@/lib/repositories/plans-tenants-leads.repository'

export const dynamic = 'force-dynamic'

const tenantsRepo = new TenantsRepository()

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user || !['supervisor', 'master'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Acesso negado' }, { status: 403 })
  }

  try {
    const tenant = await tenantsRepo.findById(session.user.tenantId)
    const instanceName = tenant?.evolutionInstance || process.env.EVOLUTION_INSTANCE || ''
    if (!instanceName) {
      return NextResponse.json({ success: false, error: `Instância não configurada. tenantId=${session.user.tenantId}` }, { status: 400 })
    }

    const client = EvolutionClient.fromEnv(instanceName)
    const qr = await client.getQRCode()

    return NextResponse.json({ success: true, data: qr })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
