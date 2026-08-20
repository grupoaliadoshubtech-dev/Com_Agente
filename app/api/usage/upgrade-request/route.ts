// app/api/usage/upgrade-request/route.ts
// POST — cliente solicita upgrade de plano
// Envia e-mail para master admin + confirmação para a empresa

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession }          from 'next-auth'
import { authOptions }               from '@/lib/auth'
import { queryOne }                  from '@/lib/supabase/db'
import { sendMail }                  from '@/lib/email/mailer'

interface TenantRow extends Record<string, unknown> {
  name:  string
  email: string
  phone: string
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ success: false, error: 'Não autenticado' }, { status: 401 })

  const { targetPlanId, targetPlanName, targetPlanPrice } = await req.json() as {
    targetPlanId: string; targetPlanName: string; targetPlanPrice: number
  }
  if (!targetPlanId || !targetPlanName) {
    return NextResponse.json({ success: false, error: 'Plano inválido' }, { status: 400 })
  }

  try {
    const tenantId = session.user.tenantId
    const tenant = await queryOne<TenantRow>(
      'SELECT name, email, phone FROM app.empresas WHERE id = $1', [tenantId]
    )
    if (!tenant) return NextResponse.json({ success: false, error: 'Empresa não encontrada' }, { status: 404 })

    const masterEmail = process.env.MASTER_EMAIL ?? process.env.SMTP_USER ?? ''
    const priceStr    = targetPlanPrice > 0
      ? `R$ ${(targetPlanPrice / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês`
      : 'Sob consulta'

    // 1. E-mail para o master admin
    if (masterEmail) {
      await sendMail({
        to:      masterEmail,
        subject: `[ComAgente] Solicitação de Upgrade — ${tenant.name}`,
        html: upgradeRequestMasterTemplate(tenant.name, tenant.email, tenant.phone, targetPlanName, priceStr),
      }).catch(err => console.error('[UpgradeRequest] Erro e-mail master:', err))
    }

    // 2. Confirmação para a empresa
    if (tenant.email) {
      await sendMail({
        to:      tenant.email,
        subject: `[ComAgente] Recebemos sua solicitação de upgrade — ${targetPlanName}`,
        html: upgradeRequestConfirmTemplate(tenant.name, targetPlanName, priceStr),
      }).catch(err => console.error('[UpgradeRequest] Erro e-mail empresa:', err))
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[/api/usage/upgrade-request]', err)
    return NextResponse.json({ success: false, error: 'Erro interno' }, { status: 500 })
  }
}

function upgradeRequestMasterTemplate(company: string, email: string, phone: string, plan: string, price: string) {
  return `
<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">
  <div style="text-align:center;margin-bottom:28px;">
    <span style="font-size:26px;font-weight:900;color:#fff;">Com</span><span style="font-size:26px;font-weight:900;color:#a3e635;">Agente</span>
  </div>
  <div style="background:#1a1d27;border-radius:14px;padding:28px;border:1px solid rgba(255,255,255,.08);">
    <div style="background:#a3e635;color:#0a0a0a;border-radius:8px;padding:10px 16px;display:inline-block;font-size:13px;font-weight:700;margin-bottom:20px;">📈 Solicitação de Upgrade</div>
    <p style="color:#f0f0f0;font-size:15px;font-weight:600;margin:0 0 16px;">Nova solicitação de mudança de plano</p>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
      <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;width:40%;">Empresa</td><td style="padding:8px 0;color:#f0f0f0;font-size:13px;font-weight:600;">${company}</td></tr>
      <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;">E-mail</td><td style="padding:8px 0;color:#f0f0f0;font-size:13px;">${email}</td></tr>
      <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;">Telefone</td><td style="padding:8px 0;color:#f0f0f0;font-size:13px;">${phone || '—'}</td></tr>
      <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;">Plano desejado</td><td style="padding:8px 0;color:#a3e635;font-size:14px;font-weight:700;">${plan}</td></tr>
      <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;">Valor</td><td style="padding:8px 0;color:#f0f0f0;font-size:13px;font-weight:600;">${price}</td></tr>
    </table>
    <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:0;">Entre em contato com a empresa para confirmar o upgrade e processar o pagamento.</p>
  </div>
</div></body></html>`
}

function upgradeRequestConfirmTemplate(company: string, plan: string, price: string) {
  const firstName = company.split(' ')[0]
  return `
<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:40px 24px;">
  <div style="text-align:center;margin-bottom:28px;">
    <span style="font-size:26px;font-weight:900;color:#fff;">Com</span><span style="font-size:26px;font-weight:900;color:#a3e635;">Agente</span>
  </div>
  <div style="background:#1a1d27;border-radius:14px;padding:28px;border:1px solid rgba(255,255,255,.08);">
    <p style="color:#f0f0f0;font-size:15px;margin:0 0 16px;">Olá, ${firstName}!</p>
    <p style="color:#9ca3af;font-size:14px;line-height:1.7;margin:0 0 12px;">Recebemos sua solicitação de upgrade para o plano <strong style="color:#a3e635;">${plan}</strong> (${price}).</p>
    <p style="color:#9ca3af;font-size:14px;line-height:1.7;margin:0 0 24px;">Nossa equipe entrará em contato em breve para processar a migração do seu plano.</p>
    <div style="background:#0f1117;border-radius:10px;padding:16px;border-left:3px solid #a3e635;">
      <p style="color:#9ca3af;font-size:12px;margin:0;">Plano solicitado: <strong style="color:#a3e635;">${plan}</strong><br>Valor: ${price}</p>
    </div>
  </div>
</div></body></html>`
}
