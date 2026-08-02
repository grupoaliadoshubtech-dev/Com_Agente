// ─────────────────────────────────────────────────────────────
// app/api/admin/leads/[id]/aprovar/route.ts  — master only
// POST → aprova lead: cria tenant + usuário gestor + envia e-mail de boas-vindas
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { LeadsRepository, TenantsRepository } from '@/lib/repositories/plans-tenants-leads.repository'
import { UsersRepository } from '@/lib/repositories/users.repository'
import { sendMail, aprovacaoTemplate } from '@/lib/email/mailer'
import type { ApiResponse } from '@/types'

type Ctx = { params: { id: string } }

function gerarSenha(length = 10): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function POST(_req: NextRequest, { params }: Ctx): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'master') {
    return NextResponse.json({ success: false, error: 'Apenas Master Admin' }, { status: 403 })
  }

  try {
    const leadsRepo = new LeadsRepository()
    const lead = await leadsRepo.findById(params.id)
    if (!lead) return NextResponse.json({ success: false, error: 'Lead não encontrado' }, { status: 404 })
    console.log('[aprovar] lead encontrado:', lead.email)

    // 1. Criar tenant na aba Empresas
    const tenantsRepo = new TenantsRepository()
    const tenantId = randomUUID()
    await tenantsRepo.create({
      id:                tenantId,
      name:              lead.company,
      email:             lead.email,
      phone:             lead.phone,
      planId:            lead.planId,
      status:            'active',
      evolutionInstance: '',
      spreadsheetId:     '',
    })
    console.log('[aprovar] tenant criado:', tenantId)

    // 2. Gerar senha provisória e criar usuário gestor
    const senhaProvisoria = gerarSenha()
    const passwordHash    = await bcrypt.hash(senhaProvisoria, 10)
    const usersRepo       = new UsersRepository()
    const userId          = randomUUID()
    console.log('[aprovar] criando usuário id:', userId, 'email:', lead.email, 'tenantId:', tenantId)
    try {
      await usersRepo.create({
        id:                  userId,
        tenantId,
        email:               lead.email,
        passwordHash,
        name:                lead.name || lead.company,
        role:                'supervisor',
        phone:               lead.phone,
        canViewDashboard:    true,
        canViewCRM:          true,
        canViewTranscricoes: true,
        canViewSatisfacao:   true,
        createdAt:           new Date().toISOString(),
        isActive:            true,
        avatarUrl:           '',
      })
      console.log('[aprovar] usuário criado na planilha:', lead.email)
    } catch (userErr) {
      const userMsg = userErr instanceof Error ? userErr.message : String(userErr)
      console.error('[aprovar] FALHA ao criar usuário na planilha:', userMsg)
      throw new Error(`Falha ao criar usuário na aba Usuarios: ${userMsg}`)
    }

    // 3. Enviar e-mail de boas-vindas com credenciais
    const origin   = process.env.NEXTAUTH_URL ?? 'https://comagente.gaht.com.br'
    const loginUrl = `${origin}/login`
    try {
      await sendMail({
        to:      lead.email,
        subject: '✓ Conta aprovada — ComAgente',
        html:    aprovacaoTemplate(lead.name || lead.company, lead.company, lead.email, senhaProvisoria, loginUrl),
      })
      console.log('[aprovar] e-mail enviado para:', lead.email)
    } catch (mailErr) {
      console.error('[aprovar] falha no e-mail (não bloqueia):', mailErr instanceof Error ? mailErr.message : mailErr)
    }

    // 4. Atualizar status do lead para converted
    await leadsRepo.updateById(params.id, { status: 'converted' })
    console.log('[aprovar] lead convertido')

    return NextResponse.json({ success: true, message: 'Empresa criada e e-mail enviado.' })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/admin/leads/[id]/aprovar]', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
