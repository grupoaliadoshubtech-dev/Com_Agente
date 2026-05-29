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
  type ConnectionUpdateData,
} from '@/lib/evolution/webhook-types'
import { appendRows } from '@/lib/sheets/client'
import { saveReceivedMessage } from '@/lib/evolution/db-client'

const WEBHOOK_SECRET = process.env.EVOLUTION_WEBHOOK_SECRET ?? ''
const MASTER_ID      = process.env.GOOGLE_MASTER_SHEET_ID!

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── 1. Autenticação do webhook ──────────────────────────────
  if (WEBHOOK_SECRET) {
    const token = req.headers.get('x-evolution-token') ??
                  req.headers.get('apikey') ?? ''
    if (token !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // ── 2. Parse do body ────────────────────────────────────────
  let payload: EvolutionWebhookPayload
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { event, instance, data } = payload

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
      const { messages } = data as MessagesUpsertData

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

      // Persiste mensagens recebidas no PostgreSQL antes de processar
      // (Evolution API pode não salvar fromMe=false por padrão)
      for (const msg of messages) {
        if (!msg.key.fromMe) {
          await saveReceivedMessage(
            { ...msg, message: msg.message as Record<string, unknown> | undefined },
            tenant.instanceName
          ).catch(() => {})
        }
      }

      // Processa cada mensagem (normalmente só 1 por evento notify)
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
      // Atualização de status de mensagem (enviado, entregue, lido)
      // Útil para métricas futuras
      break
    }

    default:
      // Evento não tratado — apenas loga
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
