// ─────────────────────────────────────────────────────────────
// app/api/evolution/setup/route.ts
//
// POST /api/evolution/setup
// Configura o webhook da instância Evolution durante provisionamento.
// Apenas supervisor ou master.
//
// POST /api/evolution/send
// Envia mensagem manualmente (pelo atendente no workspace).
//
// GET /api/evolution/status?instance=xxx
// Status da conexão WhatsApp da instância.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { EvolutionClient, normalizeNumber } from '@/lib/evolution/client'
import { invalidateTenantCache }            from '@/lib/evolution/tenant-resolver'
import { z } from 'zod'
import type { ApiResponse } from '@/types'

// ── POST /api/evolution/setup ─────────────────────────────────

const SetupSchema = z.object({
  instanceName: z.string().min(1),
  // URL base da aplicação para montar o webhook URL automaticamente
  appUrl:       z.string().url().optional(),
})

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user || !['supervisor', 'master'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Acesso negado' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = SetupSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Dados inválidos' }, { status: 422 })
  }

  const { instanceName, appUrl } = parsed.data

  try {
    const client       = EvolutionClient.fromEnv(instanceName)
    const webhookUrl   = appUrl
      ? `${appUrl}/api/evolution/webhook`
      : `${process.env.NEXTAUTH_URL}/api/evolution/webhook`

    await client.setWebhook({
      url:     webhookUrl,
      enabled: true,
      events:  [
        'MESSAGES_UPSERT',
        'MESSAGES_UPDATE',
        'CONNECTION_UPDATE',
        'PRESENCE_UPDATE',
      ],
    })

    // Invalida cache de tenants para nova instância aparecer imediatamente
    invalidateTenantCache()

    return NextResponse.json({
      success: true,
      message: `Webhook configurado em ${webhookUrl}`,
      data:    { instanceName, webhookUrl },
    })
  } catch (err) {
    console.error('[/api/evolution/setup]', err)
    return NextResponse.json({
      success: false,
      error:   String(err),
    }, { status: 500 })
  }
}

// ── GET /api/evolution/status?instance=xxx ────────────────────

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  const instanceName = req.nextUrl.searchParams.get('instance') ??
                       session.user.tenantId  // fallback: instância do próprio tenant

  if (!instanceName) {
    return NextResponse.json({ success: false, error: 'instance obrigatório' }, { status: 400 })
  }

  try {
    const client = EvolutionClient.fromEnv(instanceName)
    const status = await client.getStatus()
    return NextResponse.json({ success: true, data: status })
  } catch (err) {
    return NextResponse.json({
      success: false,
      error:   String(err),
    }, { status: 500 })
  }
}
