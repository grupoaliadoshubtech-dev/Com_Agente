// app/api/evolution/mark-read/route.ts
// POST /api/evolution/mark-read?phone=xxx&lid=yyy
// Marca todas as mensagens recebidas de um contato como lidas.
// Chamado em background quando o atendente abre um chat.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession }   from 'next-auth'
import { authOptions }        from '@/lib/auth'
import { EvolutionClient, numberToJid } from '@/lib/evolution/client'
import { TenantsRepository }  from '@/lib/repositories/plans-tenants-leads.repository'

const tenantsRepo  = new TenantsRepository()
const tenantCache  = new Map<string, { data: unknown; ts: number }>()

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ ok: false }, { status: 401 })

  const phone  = req.nextUrl.searchParams.get('phone')
  const lidJid = req.nextUrl.searchParams.get('lid')
  if (!phone) return NextResponse.json({ ok: false }, { status: 400 })

  try {
    const cacheKey = session.user.tenantId
    const cached   = tenantCache.get(cacheKey)
    const tenant   = (cached && Date.now() - cached.ts < 60000
      ? cached.data
      : await tenantsRepo.findById(cacheKey).then(t => { tenantCache.set(cacheKey, { data: t, ts: Date.now() }); return t })
    ) as { evolutionInstance?: string } | null

    const instanceName = tenant?.evolutionInstance
    if (!instanceName) return NextResponse.json({ ok: false }, { status: 400 })

    const client   = EvolutionClient.fromEnv(instanceName)
    const phoneJid = numberToJid(phone)

    // Busca as mensagens recebidas recentes desse contato
    const received = await client.findReceivedMessages(phoneJid, 50)
    if (received.length === 0) return NextResponse.json({ ok: true, marked: 0 })

    // Marca todas como lidas
    await client.markMessagesAsRead(
      received.map(m => ({
        remoteJid: lidJid ?? m.key.remoteJid,
        fromMe:    false,
        id:        m.key.id,
      }))
    )

    return NextResponse.json({ ok: true, marked: received.length })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
