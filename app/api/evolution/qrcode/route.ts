// ─────────────────────────────────────────────────────────────
// app/api/evolution/qrcode/route.ts
//
// GET /api/evolution/qrcode?instance=xxx
// Retorna o QR Code base64 para exibição na tela de Conexão WhatsApp.
// Apenas supervisor ou master do próprio tenant.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { EvolutionClient }  from '@/lib/evolution/client'
import { TenantsRepository } from '@/lib/repositories/plans-tenants-leads.repository'
import type { ApiResponse } from '@/types'

const tenantsRepo = new TenantsRepository()

export async function GET(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user || !['supervisor', 'master'].includes(session.user.role)) {
    return NextResponse.json({ success: false, error: 'Acesso negado' }, { status: 403 })
  }

  // Usa instância do tenant ou parâmetro explícito (master only)
  let instanceName = req.nextUrl.searchParams.get('instance')

  if (!instanceName) {
    const tenant     = await tenantsRepo.findById(session.user.tenantId)
    instanceName     = tenant?.evolutionInstance ?? null
  }

  if (!instanceName) {
    return NextResponse.json({
      success: false,
      error:   'Instância não configurada. Contate o administrador.',
    }, { status: 400 })
  }

  try {
    const client = EvolutionClient.fromEnv(instanceName)

    // Verifica status primeiro
    const status = await client.getStatus()

    if (status.instance.state === 'open') {
      return NextResponse.json({
        success: true,
        data:    {
          connected:   true,
          state:       'open',
          profileName: status.instance.profileName,
          phone:       status.instance.phoneNumber,
        },
      })
    }

    // Gera QR Code
    const qr = await client.getQRCode()

    return NextResponse.json({
      success: true,
      data:    {
        connected: false,
        state:     status.instance.state,
        qrcode:    qr.qrcode.base64,  // já vem em base64 pelo Evolution
        code:      qr.qrcode.code,
      },
    })
  } catch (err) {
    console.error('[/api/evolution/qrcode]', err)
    return NextResponse.json({
      success: false,
      error:   `Erro ao obter QR Code: ${String(err)}`,
    }, { status: 500 })
  }
}
