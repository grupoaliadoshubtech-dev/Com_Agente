// ─────────────────────────────────────────────────────────────
// app/api/evolution/send/route.ts
//
// POST /api/evolution/send
// Envia mensagem de texto pelo atendente logado a partir do workspace.
// Autentica, resolve instância do tenant, delega ao EvolutionClient.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { EvolutionClient, normalizeNumber } from '@/lib/evolution/client'
import { TenantsRepository } from '@/lib/repositories/plans-tenants-leads.repository'
import { appendRows }        from '@/lib/sheets/client'
import { z } from 'zod'
import type { ApiResponse } from '@/types'

const SendSchema = z.object({
  to:           z.string().min(8),   // número do destinatário
  text:         z.string().min(1),
  withTyping:   z.boolean().default(true),
  // Opcional: especificar instância (master pode enviar por qualquer tenant)
  instanceName: z.string().optional(),
})

const tenantsRepo = new TenantsRepository()

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  // ── Auth ────────────────────────────────────────────────────
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = SendSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Dados inválidos' }, { status: 422 })
  }

  const { to, text, withTyping, instanceName: overrideInstance } = parsed.data

  // ── Resolve instância ───────────────────────────────────────
  let instanceName = overrideInstance

  if (!instanceName) {
    // Busca a instância do tenant do usuário logado
    const tenant = await tenantsRepo.findById(session.user.tenantId)
    instanceName = tenant?.evolutionInstance
  }

  if (!instanceName) {
    return NextResponse.json({
      success: false,
      error:   'Instância WhatsApp não configurada para este tenant. Configure em Conexão WhatsApp.',
    }, { status: 400 })
  }

  // ── Envia mensagem ──────────────────────────────────────────
  const number = normalizeNumber(to)

  try {
    const client = EvolutionClient.fromEnv(instanceName)

    const result = withTyping
      ? await client.sendTextWithTyping(number, text)
      : await client.sendText({ number, text })

    // Grava na aba Atendimentos como mensagem humana
    await appendRows(session.user.tenantId, 'Atendimentos!A:H', [[
      `msg_${Date.now()}`,
      number,
      '',
      new Date().toISOString(),
      new Date().toISOString(),
      '',
      session.user.id,          // atendente que enviou
      text.slice(0, 100),
    ]]).catch(console.error)    // não bloqueia se falhar

    return NextResponse.json({
      success: true,
      message: 'Mensagem enviada',
      data:    { messageId: result.key.id, to: number },
    })
  } catch (err) {
    console.error('[/api/evolution/send]', err)
    return NextResponse.json({
      success: false,
      error:   `Erro ao enviar mensagem: ${String(err)}`,
    }, { status: 500 })
  }
}
