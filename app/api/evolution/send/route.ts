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
import { execute }           from '@/lib/supabase/db'
import { z } from 'zod'
import type { ApiResponse } from '@/types'

const SendSchema = z.object({
  to:           z.string().min(8),
  text:         z.string().min(1).max(4096),
  withTyping:   z.boolean().default(true),
  // Apenas master pode sobrescrever a instância
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

  // ── Resolve tenant (instância + schema Supabase) ────────────
  const tenant = await tenantsRepo.findById(session.user.tenantId)

  let instanceName: string | undefined
  if (session.user.role === 'master' && overrideInstance) {
    instanceName = overrideInstance
  } else {
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

    // Grava na tabela atendimentos do tenant como mensagem humana
    const schema = tenant?.supabaseSchema
    if (schema) {
      execute(
        `INSERT INTO ${schema}.atendimentos (id, telefone, nome, inicio, atendente)
         VALUES ($1, $2, '', NOW(), $3)
         ON CONFLICT (id) DO NOTHING`,
        [`msg_${Date.now()}`, number, session.user.id]
      ).catch(console.error)
    }

    return NextResponse.json({
      success: true,
      message: 'Mensagem enviada',
      data:    { messageId: result.key.id, to: number },
    })
  } catch (err) {
    console.error('[/api/evolution/send]', err)
    return NextResponse.json({
      success: false,
      error:   "Erro ao enviar mensagem.",
    }, { status: 500 })
  }
}
