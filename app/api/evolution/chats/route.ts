// app/api/evolution/chats/route.ts
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { EvolutionClient, jidToNumber } from '@/lib/evolution/client'
import { TenantsRepository } from '@/lib/repositories/plans-tenants-leads.repository'
import { HandoffRepository } from '@/lib/repositories/handoff.repository'
import { ClientesRepository } from '@/lib/repositories/clientes.repository'
import { getLidMapping } from '@/lib/evolution/db-client'
import type { ApiResponse } from '@/types'

export const dynamic = 'force-dynamic'

const tenantsRepo   = new TenantsRepository()
const tenantCache   = new Map<string, { data: unknown; ts: number }>()
const handoffCache  = new Map<string, { data: unknown[]; ts: number }>()
const clientesCache = new Map<string, { map: Map<string, string>; ts: number }>()

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
      return NextResponse.json({ success: false, error: 'Instância WhatsApp não configurada' }, { status: 400 })
    }

    const client = EvolutionClient.fromEnv(instanceName)
    const chats = await client.findChats()

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

    // Busca nomes cadastrados na aba Clientes da planilha do tenant
    const cachedClientes = clientesCache.get(cacheKey)
    let clienteNames = new Map<string, string>()
    if (cachedClientes && Date.now() - cachedClientes.ts < 60000) {
      clienteNames = cachedClientes.map
    } else {
      try {
        const clientesRepo = new ClientesRepository(cacheKey)
        clienteNames = await clientesRepo.buildNameMap()
        clientesCache.set(cacheKey, { map: clienteNames, ts: Date.now() })
      } catch { /* planilha pode não ter a aba ainda */ }
    }

    // Busca mapeamento @lid → @s.whatsapp.net do PostgreSQL
    const lidToPhone = await getLidMapping(instanceName)
    const phoneToLid = new Map<string, string>()
    lidToPhone.forEach((phone, lid) => {
      phoneToLid.set(phone, lid)
    })

    // Agrupa chats unificando @lid + @s.whatsapp.net
    const unified = new Map<string, {
      telefone: string
      lidJid: string | null
      nome: string
      preview: string
      timestamp: string
      iaStatus: string
      unreadCount: number
      profilePicUrl: string | null
    }>()

    for (const chat of chats) {
      const jid = chat.remoteJid
      if (!jid) continue
      if (jid === 'status@broadcast') continue
      if (jid.endsWith('@g.us')) continue

      let phoneJid: string
      let lidJid: string | null = null

      if (jid.endsWith('@lid')) {
        const mapped = lidToPhone.get(jid)
        if (!mapped) continue
        phoneJid = mapped
        lidJid = jid
      } else if (jid.endsWith('@s.whatsapp.net')) {
        phoneJid = jid
        lidJid = phoneToLid.get(jid) ?? null
      } else {
        continue
      }

      const phone = jidToNumber(phoneJid)
      const clienteNome = clienteNames.get(phone) ?? null
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

      const existing = unified.get(phoneJid)
      if (!existing || new Date(timestamp) > new Date(existing.timestamp)) {
        unified.set(phoneJid, {
          telefone: phone,
          lidJid: lidJid ?? existing?.lidJid ?? null,
          nome: clienteNome ?? chat.pushName ?? lastMsg?.pushName ?? phone,
          preview: fromMe ? `Você: ${preview}` : preview,
          timestamp,
          iaStatus,
          unreadCount: (existing?.unreadCount ?? 0) + (chat.unreadCount ?? 0),
          profilePicUrl: chat.profilePicUrl ?? existing?.profilePicUrl ?? null,
        })
      } else if (lidJid && !existing.lidJid) {
        existing.lidJid = lidJid
        existing.unreadCount += chat.unreadCount ?? 0
      }
    }

    const formatted = Array.from(unified.values())
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 100)

    return NextResponse.json({ success: true, data: formatted })
  } catch (err) {
    console.error('[/api/evolution/chats]', err)
    return NextResponse.json({ success: false, error: "Erro ao buscar chats." }, { status: 500 })
  }
}