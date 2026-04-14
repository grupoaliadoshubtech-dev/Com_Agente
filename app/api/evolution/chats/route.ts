// app/api/evolution/chats/route.ts
// GET /api/evolution/chats
// Proxy para Evolution API — lista conversas com último preview.
// Filtra grupos e status broadcasts, retorna apenas chats individuais.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EvolutionClient, jidToNumber } from '@/lib/evolution/client'
import { TenantsRepository } from '@/lib/repositories/plans-tenants-leads.repository'
import { HandoffRepository } from '@/lib/repositories/handoff.repository'
import type { ApiResponse } from '@/types'

export const dynamic = 'force-dynamic'

const tenantsRepo = new TenantsRepository()
const tenantCache = new Map<string, { data: unknown; ts: number }>()
const handoffCache = new Map<string, { data: unknown[]; ts: number }>()

function extractText(message?: Record<string, unknown>): string {
  if (!message) return ''
  if (typeof message.conversation === 'string') return message.conversation
  const ext = message.extendedTextMessage as Record<string, unknown> | undefined
  if (ext && typeof ext.text === 'string') return ext.text
  if (message.imageMessage) return '📷 Imagem'
  if (message.audioMessage) return '🎵 Áudio'
  if (message.videoMessage) return '🎬 Vídeo'
  if (message.documentMessage) return '📄 Documento'
  if (message.stickerMessage) return '🏷️ Sticker'
  if (message.locationMessage) return '📍 Localização'
  if (message.contactMessage) return '👤 Contato'
  return ''
}

export async function GET(): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  try {
    // Tenant com cache de 60s
    const cacheKey = session.user.tenantId
    const cachedTenant = tenantCache.get(cacheKey)
    const tenant = cachedTenant && Date.now() - cachedTenant.ts < 60000
      ? cachedTenant.data
      : await tenantsRepo.findById(cacheKey).then(t => {
          tenantCache.set(cacheKey, { data: t, ts: Date.now() })
          return t
        }) as { evolutionInstance?: string } | null

    const instanceName = (tenant as { evolutionInstance?: string } | null)?.evolutionInstance
    if (!instanceName) {
      return NextResponse.json({
        success: false,
        error: 'Instância WhatsApp não configurada',
      }, { status: 400 })
    }

    const client = EvolutionClient.fromEnv(instanceName)
    const chats = await client.findChats()

    // Handoff com cache de 30s
    const cachedHandoff = handoffCache.get(cacheKey)
    let handoffRecords: Array<{ telefone: string; status: string; timestamp: string; atendente: string }> = []
    if (cachedHandoff && Date.now() - cachedHandoff.ts < 30000) {
      handoffRecords = cachedHandoff.data as typeof handoffRecords
    } else {
      try {
        const handoff = new HandoffRepository(cacheKey)
        handoffRecords = await handoff.getAll()
        handoffCache.set(cacheKey, { data: handoffRecords, ts: Date.now() })
      } catch {}
    }

    const formatted = chats
      .filter(chat => {
        if (!chat.remoteJid) return false
        if (chat.remoteJid.endsWith('@g.us')) return false
        if (chat.remoteJid === 'status@broadcast') return false
        if (!chat.remoteJid.endsWith('@s.whatsapp.net')) return false
        return true
      })
      .map(chat => {
        const phone = jidToNumber(chat.remoteJid)
        const lastMsg = chat.lastMessage
        const handoffEntry = handoffRecords
          .filter(h => h.telefone === phone || h.telefone === 'ALL')
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0]
        const iaStatus = handoffEntry?.status === 'pausado' ? 'pausado' : 'ativo'
        const preview = lastMsg?.message
          ? extractText(lastMsg.message as Record<string, unknown>)
          : ''
        const timestamp = lastMsg?.messageTimestamp
          ? new Date(Number(lastMsg.messageTimestamp) * 1000).toISOString()
          : chat.updatedAt ?? new Date().toISOString()
        const fromMe = lastMsg?.key?.fromMe ?? false
        return {
          telefone: phone,
          remoteJid: chat.remoteJid,
          nome: chat.pushName ?? lastMsg?.pushName ?? phone,
          preview: fromMe ? `Você: ${preview}` : preview,
          timestamp,
          iaStatus,
          unreadCount: chat.unreadCount ?? 0,
          profilePicUrl: chat.profilePicUrl ?? null,
        }
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 100)

    return NextResponse.json({ success: true, data: formatted })
  } catch (err) {
    console.error('[/api/evolution/chats]', err)
    return NextResponse.json({
      success: false,
      error: `Erro ao buscar chats: ${String(err)}`,
    }, { status: 500 })
  }
}
