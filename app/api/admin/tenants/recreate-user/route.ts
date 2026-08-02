// ─────────────────────────────────────────────────────────────
// app/api/admin/tenants/recreate-user/route.ts  — master only
// POST { tenantId } → cria usuário gestor faltante + envia e-mail
// Usado para corrigir tenants que têm linha em Empresas mas não em Usuarios
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession }          from 'next-auth'
import { authOptions }               from '@/lib/auth'
import bcrypt                        from 'bcryptjs'
import { randomUUID }                from 'crypto'
import { TenantsRepository }         from '@/lib/repositories/plans-tenants-leads.repository'
import { UsersRepository }           from '@/lib/repositories/users.repository'
import { sendMail, aprovacaoTemplate } from '@/lib/email/mailer'
import type { ApiResponse }          from '@/types'

function gerarSenha(length = 10): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'master') {
    return NextResponse.json({ success: false, error: 'Apenas Master Admin' }, { status: 403 })
  }

  let tenantId: string
  try {
    const body = await req.json()
    tenantId = body.tenantId
    if (!tenantId) throw new Error('tenantId ausente')
  } catch {
    return NextResponse.json({ success: false, error: 'Body inválido: { tenantId }' }, { status: 400 })
  }

  try {
    // 1. Busca tenant
    const tenantsRepo = new TenantsRepository()
    const tenant = await tenantsRepo.findById(tenantId)
    if (!tenant) {
      return NextResponse.json({ success: false, error: `Tenant ${tenantId} não encontrado em Empresas.` }, { status: 404 })
    }
    console.log('[recreate-user] tenant encontrado:', tenant.name, tenant.email)

    // 2. Verifica se já existe usuário com esse tenantId
    const usersRepo = new UsersRepository()
    const existentes = await usersRepo.findByTenantId(tenantId)
    if (existentes.length > 0) {
      return NextResponse.json({
        success: false,
        error: `Já existe(m) ${existentes.length} usuário(s) para esse tenant: ${existentes.map(u => u.email).join(', ')}`,
      }, { status: 409 })
    }

    // 3. Cria usuário gestor com senha provisória
    const senhaProvisoria = gerarSenha()
    const passwordHash    = await bcrypt.hash(senhaProvisoria, 10)
    const userId          = randomUUID()
    console.log('[recreate-user] criando usuário id:', userId, 'email:', tenant.email)

    await usersRepo.create({
      id:                  userId,
      tenantId,
      email:               tenant.email,
      passwordHash,
      name:                tenant.name,
      role:                'supervisor',
      phone:               tenant.phone ?? '',
      canViewDashboard:    true,
      canViewCRM:          true,
      canViewTranscricoes: true,
      canViewSatisfacao:   true,
      createdAt:           new Date().toISOString(),
      isActive:            true,
      avatarUrl:           '',
    })
    console.log('[recreate-user] usuário criado na planilha:', tenant.email)

    // 4. Envia e-mail com credenciais (não bloqueia em caso de falha)
    const origin   = process.env.NEXTAUTH_URL ?? 'https://comagente.gaht.com.br'
    const loginUrl = `${origin}/login`
    try {
      await sendMail({
        to:      tenant.email,
        subject: '✓ Acesso ComAgente — credenciais',
        html:    aprovacaoTemplate(tenant.name, tenant.name, tenant.email, senhaProvisoria, loginUrl),
      })
      console.log('[recreate-user] e-mail enviado para:', tenant.email)
    } catch (mailErr) {
      console.error('[recreate-user] falha no e-mail (não bloqueia):', mailErr instanceof Error ? mailErr.message : mailErr)
    }

    return NextResponse.json({
      success: true,
      message: `Usuário criado para ${tenant.name} (${tenant.email}). Senha enviada por e-mail.`,
      data: { userId, email: tenant.email, tenantId },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/admin/tenants/recreate-user]', msg)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
