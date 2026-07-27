// app/api/evolution/messages/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EvolutionClient, numberToJid } from '@/lib/evolution/client'
import { TenantsRepository } from '@/lib/repositories/plans-tenants-leads.repository'
import type { ApiResponse } from '@/types'


export const dynamic = 'force-dynamic'

const tenantsRepo = new TenantsRepository()
const tenantCache = new Map<string, { data: unknown; ts: number }>()

function extractText(message?: Record<string, unknown>): string {
  if (!message) return ''
  if (typeof message.conversation === 'string') return message.conversation
  const ext = message.extendedTextMessage as Record<string, unknown> | undefined
  if (ext && typeof ext.text === 'string') return ext.text
  const img = message.imageMessage as Record<string, unknown> | undefined
  if (img) return (img.caption as string) ?? ''
  const vid = message.videoMessage as Record<string, unknown> | undefined
  if (vid) return (vid.caption as string) ?? ''
  const doc = message.documentMessage as Record<string, unknown> | undefined
  if (doc) return (doc.title as string) ?? (doc.fileName as string) ?? ''
  if (message.audioMessage) return ''
  if (message.stickerMessage) return ''
  if (message.locationMessage) {
    const loc = message.locationMessage as Record<string, unknown>
    return (loc.name as string) ?? (loc.address as string) ?? 'Localização'
  }
  if (message.contactMessage) {
    const ct = message.contactMessage as Record<string, unknown>
    return (ct.displayName as string) ?? 'Contato'
  }
  if (message.reactionMessage) return ''
  return ''
}

function extractMediaInfo(message?: Record<string, unknown>): {
  mediaType: string | null
  mimetype: string | null
  caption: string | null
  duration: number | null
  fileName: string | null
  isPtt: boolean
} {
  const none = { mediaType: null, mimetype: null, caption: null, duration: null, fileName: null, isPtt: false }
  if (!message) return none
  const img = message.imageMessage as Record<string, unknown> | undefined
  if (img) return { mediaType: 'image', mimetype: (img.mimetype as string) ?? 'image/jpeg', caption: (img.caption as string) ?? null, duration: null, fileName: null, isPtt: false }
  const aud = message.audioMessage as Record<string, unknown> | undefined
  if (aud) return { mediaType: 'audio', mimetype: (aud.mimetype as string) ?? 'audio/ogg', caption: null, duration: (aud.seconds as number) ?? null, fileName: null, isPtt: (aud.ptt as boolean) ?? false }
  const vid = message.videoMessage as Record<string, unknown> | undefined
  if (vid) return { mediaType: 'video', mimetype: (vid.mimetype as string) ?? 'video/mp4', caption: (vid.caption as string) ?? null, duration: (vid.seconds as number) ?? null, fileName: null, isPtt: false }
  const doc = message.documentMessage as Record<string, unknown> | undefined
  if (doc) return { mediaType: 'document', mimetype: (doc.mimetype as string) ?? 'application/pdf', caption: null, duration: null, fileName: (doc.title as string) ?? (doc.fileName as string) ?? 'documento', isPtt: false }
  if (message.stickerMessage) return { mediaType: 'sticker', mimetype: 'image/webp', caption: null, duration: null, fileName: null, isPtt: false }
  if (message.locationMessage) return { mediaType: 'location', mimetype: null, caption: null, duration: null, fileName: null, isPtt: false }
  if (message.contactMessage) return { mediaType: 'contact', mimetype: null, caption: null, duration: null, fileName: null, isPtt: false }
  return none
}

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  const phone = req.nextUrl.searchParams.get('phone')
  const lidJid = req.nextUrl.searchParams.get('lid') // JID @lid opcional
  const count = parseInt(req.nextUrl.searchParams.get('count') ?? '50')

  if (!phone) {
    return NextResponse.json({ success: false, error: 'phone obrigatório' }, { status: 400 })
  }

  try {
    const cacheKey = session.user.tenantId
    const cachedTenant = tenantCache.get(cacheKey)
    const tenant = (cachedTenant && Date.now() - cachedTenant.ts < 60000
      ? cachedTenant.data
      : await tenantsRepo.findById(cacheKey).then(t => {
          tenantCache.set(cacheKey, { data: t, ts: Date.now() })
          return t
        })) as { evolutionInstance?: string } | null

    const instanceName = tenant?.evolutionInstance
    if (!instanceName) {
      return NextResponse.json({ success: false, error: 'Instância não configurada' }, { status: 400 })
    }

    const phoneJid = numberToJid(phone)
    const client   = EvolutionClient.fromEnv(instanceName)

    // Duas queries HTTP provadas via teste direto na Evolution API:
    // 1. remoteJid = @s.whatsapp.net → retorna mensagens ENVIADAS (fromMe=true)
    // 2. remoteJidAlt = @s.whatsapp.net → retorna mensagens RECEBIDAS (fromMe=false, remoteJid=@lid)
    const [httpSent, httpReceived] = await Promise.all([
      client.findMessages(phoneJid, count),
      client.findReceivedMessages(phoneJid, count),
    ])

    // Merge deduplicando pelo key.id (WhatsApp message ID)
    const seen = new Set<string>()
    type MsgRow = { key: { id: string; fromMe: boolean; remoteJid: string }; pushName?: string; message?: Record<string, unknown>; messageTimestamp?: number; messageType?: string; status?: string }
    const merged: MsgRow[] = []

    for (const src of [httpSent, httpReceived]) {
      for (const m of src) {
        if (!seen.has(m.key.id)) {
          seen.add(m.key.id)
          merged.push({
            key:              m.key,
            pushName:         m.pushName,
            message:          m.message as Record<string, unknown> | undefined,
            messageTimestamp: typeof m.messageTimestamp === 'string' ? parseInt(m.messageTimestamp, 10) : m.messageTimestamp,
            messageType:      m.messageType,
            status:           m.status,
          })
        }
      }
    }

    const rawMessages = merged
      .filter(msg => {
        const m = msg.message as Record<string, unknown> | undefined
        if (!m) return false
        if (m.reactionMessage) return false
        if (m.protocolMessage) return false
        const text = extractText(m)
        const media = extractMediaInfo(m)
        return text !== '' || media.mediaType !== null
      })
      .map(msg => {
        const m = msg.message as Record<string, unknown> | undefined
        const fromMe = msg.key.fromMe
        const text = extractText(m)
        const media = extractMediaInfo(m)
        const ts = msg.messageTimestamp
          ? new Date(Number(msg.messageTimestamp) * 1000)
          : new Date()

        return {
          id: msg.key.id,
          remoteJid: msg.key.remoteJid,
          type: fromMe ? 'outgoing' as const : 'incoming' as const,
          text,
          time: ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' }),
          timestamp: ts.toISOString(),
          pushName: msg.pushName ?? phone,
          fromMe,
          mediaType: media.mediaType,
          mimetype: media.mimetype,
          caption: media.caption,
          duration: media.duration,
          fileName: media.fileName,
          isPtt: media.isPtt,
          status: msg.status ?? null,
        }
      })
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    return NextResponse.json({ success: true, data: rawMessages })
  } catch (err) {
    console.error('[/api/evolution/messages]', err)
    return NextResponse.json({ success: false, error: "Erro ao buscar mensagens." }, { status: 500 })
  }
}
