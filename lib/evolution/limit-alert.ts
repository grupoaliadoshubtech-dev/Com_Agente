// ─────────────────────────────────────────────────────────────
// lib/evolution/limit-alert.ts
//
// Envia alerta de 90% do limite de mensagens via:
//  1. SSE → modal na plataforma (todos os usuários logados do tenant)
//  2. WhatsApp → telefone cadastrado da empresa
//  3. E-mail → e-mail cadastrado da empresa
// ─────────────────────────────────────────────────────────────

import { queryOne }                from '@/lib/supabase/client'
import { pushSystemNotification }  from './notify'
import { EvolutionClient }         from './client'
import { sendMail, limitAlertTemplate } from '@/lib/email/mailer'

interface TenantAlertData {
  name:               string
  email:              string
  phone:              string
  evolution_instance: string
}

export async function sendLimitAlert(
  tenantId: string,
  current:  number,
  limit:    number
): Promise<void> {
  const tenant = await queryOne<TenantAlertData>(`
    SELECT name, email, phone, evolution_instance
    FROM app.empresas
    WHERE id = $1
  `, [tenantId])

  if (!tenant) return

  const pct      = Math.round((current / limit) * 100)
  const instance = tenant.evolution_instance

  // 1 — Notificação SSE → modal na plataforma
  if (instance) {
    await pushSystemNotification(instance, 'uso_limite', {
      current,
      limit,
      pct,
      company: tenant.name,
    }).catch(() => {})
  }

  // 2 — WhatsApp para o número da empresa
  if (instance && tenant.phone) {
    try {
      const client = EvolutionClient.fromEnv(instance)
      await client.sendText({
        number: tenant.phone,
        text: [
          `⚠️ *ComAgente — Aviso de Limite*`,
          ``,
          `Olá, *${tenant.name}*!`,
          ``,
          `Você atingiu *${pct}%* do limite de mensagens do seu plano este mês.`,
          ``,
          `📊 *Uso atual:* ${current.toLocaleString('pt-BR')} de ${limit.toLocaleString('pt-BR')} mensagens`,
          ``,
          `⏰ O contador reinicia automaticamente no início do próximo mês.`,
          ``,
          `Para fazer upgrade ou saber mais, entre em contato com o suporte ComAgente.`,
        ].join('\n'),
      })
    } catch (err) {
      console.error('[LimitAlert] Erro ao enviar WhatsApp:', err)
    }
  }

  // 3 — E-mail para o endereço da empresa
  if (tenant.email) {
    try {
      await sendMail({
        to:      tenant.email,
        subject: `[ComAgente] Aviso: ${pct}% do limite de mensagens utilizado — ${tenant.name}`,
        html:    limitAlertTemplate(tenant.name, current, limit, pct),
      })
    } catch (err) {
      console.error('[LimitAlert] Erro ao enviar e-mail:', err)
    }
  }
}
