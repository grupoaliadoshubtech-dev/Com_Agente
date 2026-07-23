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
import { UsersRepository } from '@/lib/repositories/users.repository'
import { z } from 'zod'
import type { ApiResponse } from '@/types'

const usersRepo = new UsersRepository()

// ── POST /api/evolution/setup ─────────────────────────────────

const SetupSchema = z.object({
  instanceName: z.string().min(1),
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

  const { instanceName } = parsed.data

  try {
    const client     = EvolutionClient.fromEnv(instanceName)
    const webhookUrl = `${process.env.NEXTAUTH_URL}/api/evolution/webhook`

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

// ── DELETE /api/evolution/setup — desconecta instância (logout) ──

export async function DELETE(): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user || !['supervisor', 'master'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Acesso negado' }, { status: 403 })
  }

  try {
    let tenantId = session.user.tenantId
    if (!tenantId && session.user.email) {
      const user = await usersRepo.findByEmail(session.user.email).catch(() => null)
      tenantId = user?.tenantId ?? ''
    }

    const instanceName = process.env.EVOLUTION_INSTANCE || tenantId
    if (!instanceName) {
      return NextResponse.json({ success: false, error: 'Instância não identificada' }, { status: 400 })
    }

    const client = EvolutionClient.fromEnv(instanceName)
    await client.logout()
    return NextResponse.json({ success: true, message: 'WhatsApp desconectado' })
  } catch (err) {
    console.error('[DELETE /api/evolution/setup]', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}

// ── GET /api/evolution/status?instance=xxx ────────────────────

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  // Sempre usa a instância do próprio tenant — ignora parâmetro externo para evitar IDOR
  const instanceName = session.user.tenantId
  if (!instanceName) {
    return NextResponse.json({ success: false, error: 'Tenant não identificado' }, { status: 400 })
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
