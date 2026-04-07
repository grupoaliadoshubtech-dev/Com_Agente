// ─────────────────────────────────────────────────────────────
// app/api/auth/forgot-password/route.ts
//
// POST /api/auth/forgot-password
// Body: { email: string }
//
// Fluxo:
// 1. Busca usuário pelo e-mail na planilha Master
// 2. Gera token seguro (32 bytes hex) com TTL 1h
// 3. Persiste token na aba ResetTokens
// 4. Envia e-mail com link de redefinição
//
// Responde sempre 200 para não vazar se o e-mail existe.
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { UsersRepository }      from '@/lib/repositories/users.repository'
import { ResetTokenRepository } from '@/lib/repositories/reset-token.repository'
import { sendMail, resetPasswordTemplate } from '@/lib/email/mailer'

const Schema = z.object({ email: z.string().email() })

const ALWAYS_OK = NextResponse.json({
  success: true,
  message: 'Se o e-mail estiver cadastrado, você receberá as instruções em breve.',
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) return ALWAYS_OK   // não vazar erros de validação

  const email = parsed.data.email.toLowerCase().trim()

  try {
    // 1. Busca usuário — responde OK mesmo se não encontrar
    const repo = new UsersRepository()
    const user = await repo.findByEmail(email)
    if (!user || !user.isActive) return ALWAYS_OK

    // 2. Gera token
    const tokenRepo = new ResetTokenRepository()
    const token     = await tokenRepo.create(user.id, email)

    // 3. Monta URL
    const appUrl   = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const resetUrl = `${appUrl}/redefinir-senha?token=${token}`

    // 4. Envia e-mail
    await sendMail({
      to:      email,
      subject: 'Redefinição de senha — Agência de Atendimento Digital',
      html:    resetPasswordTemplate(user.name, resetUrl),
    })

    console.log(`[forgot-password] E-mail enviado para ${email}`)
  } catch (err) {
    // Loga mas não expõe para o cliente
    console.error('[forgot-password] Erro interno:', err)
  }

  return ALWAYS_OK
}
