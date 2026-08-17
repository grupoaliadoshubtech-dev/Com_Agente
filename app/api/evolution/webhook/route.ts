// ─────────────────────────────────────────────────────────────
// app/api/evolution/webhook/route.ts
//
// Endpoint que recebe TODOS os eventos da Evolution API.
// URL configurada por instância via /api/evolution/setup.
//
// Segurança: verifica header "x-evolution-token" contra
// EVOLUTION_WEBHOOK_SECRET do env para evitar chamadas externas.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { MessageProcessor }    from '@/lib/evolution/message-processor'
import { resolveTenant }       from '@/lib/evolution/tenant-resolver'
import {
  type EvolutionWebhookPayload,
  type MessagesUpsertData,
  type WebhookMessage,
  type ConnectionUpdateData,
} from '@/lib/evolution/webhook-types'
import { appendRows } from '@/lib/sheets/client'
import { pushNotification } from '@/lib/evolution/notify'

const MASTER_ID = process.env.GOOGLE_MASTER_SHEET_ID!

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Autenticação do webhook ──────────────────────────────
  const WEBHOOK_SECRET = process.env.EVOLUTION_WEBHOOK_SECRET
  if (!WEBHOOK_SECRET) {
    console.error('[Webhook] EVOLUTION_WEBHOOK_SECRET não configurado.')
    return NextResponse.json({ error: 'Webhook não configurado no servidor' }, { status: 500 })
  }
  const token = req.headers.get('x-evolution-token') ??
                req.headers.get('apikey') ??
                req.nextUrl.searchParams.get('secret') ?? ''
  if (token !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 2. Parse do body ────────────────────────────────────────
  let payload: EvolutionWebhookPayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { event: rawEvent, instance, data } = payload
  // Normaliza: 'messages.upsert' → 'MESSAGES_UPSERT' (webhook global usa dot-notation lowercase)
  const event = rawEvent.toUpperCase().replace(/\./g, '_')

  // Responde imediatamente — processamento é async para não dar timeout
  // O Evolution API espera 200 em < 5s
  const responsePromise = processWebhookEvent(event, instance, data)

  // Fire-and-forget com log de erro
  responsePromise.catch(err => {
    console.error(`[Webhook] Erro não tratado — evento ${event}:`, err)
    // Tenta gravar no log de erros do Master
    appendRows(MASTER_ID, 'Log_Erros!A:D', [[
      new Date().toISOString(),
      `webhook/${event}`,
      String(err),
      instance,
    ]]).catch(console.error)
  })

  return NextResponse.json({ received: true, event })
}

// ── Processador de eventos ────────────────────────────────────

async function processWebhookEvent(
  event:    string,
  instance: string,
  data:     unknown
): Promise<void> {
  switch (event) {

    case 'MESSAGES_UPSERT': {
      // Evolution API pode enviar { messages: [...] } ou o array direto
      const raw = data as MessagesUpsertData | WebhookMessage[]
      const messages: WebhookMessage[] = Array.isArray(raw) ? raw : (raw.messages ?? [])
      if (!messages.length) break

      // Sinaliza ao frontend (SSE) imediatamente — independente do tenant
      const firstMsg = messages[0]
      if (firstMsg) {
        const phone = firstMsg.key.remoteJidAlt?.endsWith('@s.whatsapp.net')
          ? firstMsg.key.remoteJidAlt
          : firstMsg.key.remoteJid?.endsWith('@s.whatsapp.net')
            ? firstMsg.key.remoteJid
            : null
        console.log(`[Webhook] MESSAGES_UPSERT → pushNotification(instance="${instance}", phone="${phone}")`)
        pushNotification(instance, phone).catch(err => console.error('[Webhook] pushNotification erro:', err))
      }

      // Resolve o tenant pela instância
      const tenant = await resolveTenant(instance)
      if (!tenant) {
        console.warn(`[Webhook] Instância "${instance}" sem tenant registrado.`)
        return
      }

      const processor = new MessageProcessor({
        tenantSpreadsheetId: tenant.spreadsheetId,
        instanceName:        tenant.instanceName,
        attendantNumber:     tenant.attendantNumber,
      })

      for (const msg of messages) {
        await processor.process(msg).catch(err => {
          console.error(`[Webhook] Erro ao processar mensagem ${msg.key.id}:`, err)
        })
      }
      break
    }

    case 'CONNECTION_UPDATE': {
      const conn = data as ConnectionUpdateData
      console.log(`[Webhook] Conexão "${instance}": ${conn.state}`)
      // Aqui você pode atualizar status na UI via Server-Sent Events (futuro)
      break
    }

    case 'MESSAGES_UPDATE': {
      break
    }

    case 'CHATS_UPDATE':
    case 'CHATS_UPSERT': {
      // Chat atualizado = nova mensagem chegou — dispara SSE para o frontend
      const chatArr = Array.isArray(data) ? data as Array<{ id?: string }> : [data as { id?: string }]
      const chatJid = chatArr[0]?.id ?? ''
      const phone = chatJid.endsWith('@s.whatsapp.net') ? chatJid : null
      console.log(`[Webhook] ${event} → pushNotification(instance="${instance}", phone="${phone}", jid="${chatJid}")`)
      pushNotification(instance, phone).catch(err => console.error('[Webhook] pushNotification erro:', err))
      break
    }

    default:
      console.log(`[Webhook] Evento não tratado: ${event} (instância: ${instance})`)
  }
}

// GET para confirmar que o endpoint está ativo (health check)
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    status:    'ok',
    endpoint:  '/api/evolution/webhook',
    timestamp: new Date().toISOString(),
  })
}
