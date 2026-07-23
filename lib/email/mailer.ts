// ─────────────────────────────────────────────────────────────
// lib/email/mailer.ts
//
// Serviço de e-mail via Nodemailer.
// Suporta SMTP genérico (Gmail, SendGrid, Resend SMTP, etc.)
// Variáveis de ambiente:
//   SMTP_HOST     → ex: smtp.gmail.com
//   SMTP_PORT     → ex: 587
//   SMTP_USER     → e-mail remetente
//   SMTP_PASS     → senha ou app password
//   SMTP_FROM     → ex: "AAD <noreply@aad.com.br>"
// ─────────────────────────────────────────────────────────────

import nodemailer from 'nodemailer'

function getTransporter() {
  const host = process.env.SMTP_HOST
  const port = process.env.SMTP_PORT
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    throw new Error('[Mailer] SMTP_HOST, SMTP_USER e SMTP_PASS são obrigatórios.')
  }

  return nodemailer.createTransport({
    host,
    port:   port ? parseInt(port) : 587,
    secure: port === '465',
    auth:   { user, pass },
  })
}

export interface SendMailOptions {
  to:      string
  subject: string
  html:    string
  text?:   string
}

export async function sendMail(opts: SendMailOptions): Promise<void> {
  const transporter = getTransporter()
  const from        = process.env.SMTP_FROM ?? process.env.SMTP_USER

  await transporter.sendMail({
    from,
    to:      opts.to,
    subject: opts.subject,
    html:    opts.html,
    text:    opts.text ?? opts.html.replace(/<[^>]+>/g, ''),
  })
}

// ── Templates ─────────────────────────────────────────────────

export function resetPasswordTemplate(name: string, resetUrl: string): string {
  const firstName = name.split(' ')[0]
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:24px;background:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#222222;line-height:1.6;">
  <p>Olá, ${firstName},</p>
  <p>Recebemos uma solicitação para redefinir a senha da sua conta no <strong>ComAgente</strong>.</p>
  <p>Clique no link abaixo para criar uma nova senha:</p>
  <p><a href="${resetUrl}" style="color:#2563eb;">${resetUrl}</a></p>
  <p>Este link expira em <strong>1 hora</strong>.</p>
  <p>Se você não solicitou a redefinição de senha, ignore este e-mail — sua senha permanece a mesma e nenhuma alteração será feita.</p>
  <br>
  <p>Atenciosamente,<br>Equipe ComAgente</p>
</body>
</html>
  `.trim()
}
