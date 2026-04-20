// app/api/evolution/media/route.ts
// GET /api/evolution/media?messageId=xxx&remoteJid=yyy
// Proxy para Evolution API — baixa mídia de uma mensagem como base64.
// Retorna a mídia como resposta binária com Content-Type correto.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EvolutionClient } from '@/lib/evolution/client'
import { TenantsRepository } from '@/lib/repositories/plans-tenants-leads.repository'

export const dynamic = 'force-dynamic'

const tenantsRepo = new TenantsRepository()

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const messageId = req.nextUrl.searchParams.get('messageId')
  const remoteJid = req.nextUrl.searchParams.get('remoteJid')

  if (!messageId || !remoteJid) {
    return NextResponse.json({ error: 'messageId e remoteJid obrigatórios' }, { status: 400 })
  }

 try {
    const tenant = await tenantsRepo.findById(session.user.tenantId)
    const instanceName = tenant?.evolutionInstance
    if (!instanceName) {
      return NextResponse.json({ error: 'Instância não configurada' }, { status: 400 })
    }

    // Converte @lid para @s.whatsapp.net se necessário
    const resolvedJid = remoteJid.endsWith('@lid')
      ? remoteJid.replace('@lid', '@s.whatsapp.net').replace(/^\d+/, m => {
          // Tenta buscar o número real — fallback: usa o número do lid diretamente
          return m
        })
      : remoteJid

    const client = EvolutionClient.fromEnv(instanceName)
    const media = await client.getMediaBase64(messageId, resolvedJid)

    return NextResponse.json({
      success: true,
      data: {
        base64:   media.base64,
        mimetype: media.mimetype,
        fileName: media.fileName ?? null,
      }
    })
  }