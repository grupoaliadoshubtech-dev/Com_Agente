// app/api/evolution/send-media/route.ts
// POST /api/evolution/send-media
// Envia mídia (imagem, áudio, documento, vídeo) pelo atendente.
// Aceita base64 no body.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EvolutionClient, normalizeNumber } from '@/lib/evolution/client'
import { TenantsRepository } from '@/lib/repositories/plans-tenants-leads.repository'
import { z } from 'zod'
import type { ApiResponse } from '@/types'

const SendMediaSchema = z.object({
  to:        z.string().min(8),
  media:     z.string().min(10),        // base64 ou URL
  mediatype: z.enum(['image', 'document', 'audio', 'video']),
  mimetype:  z.string().min(3),
  caption:   z.string().optional(),
  fileName:  z.string().optional(),
})

const tenantsRepo = new TenantsRepository()

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = SendMediaSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Dados inválidos' }, { status: 422 })
  }

  const { to, media, mediatype, mimetype, caption, fileName } = parsed.data

  try {
    const tenant = await tenantsRepo.findById(session.user.tenantId)
    const instanceName = tenant?.evolutionInstance
    if (!instanceName) {
      return NextResponse.json({ success: false, error: 'Instância não configurada' }, { status: 400 })
    }

    const client = EvolutionClient.fromEnv(instanceName)
    const number = normalizeNumber(to)

    const result = await client.sendMedia({
      number,
      mediatype,
      mimetype,
      caption,
      media,
      fileName,
    })

    return NextResponse.json({
      success: true,
      message: 'Mídia enviada',
      data: { messageId: result.key.id, to: number },
    })
  } catch (err) {
    console.error('[/api/evolution/send-media]', err)
    return NextResponse.json({
      success: false,
      error: `Erro ao enviar mídia: ${String(err)}`,
    }, { status: 500 })
  }
}
