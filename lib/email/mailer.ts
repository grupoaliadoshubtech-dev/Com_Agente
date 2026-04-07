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
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Redefinir senha — AAD</title>
</head>
<body style="margin:0;padding:0;background:#121212;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#121212;min-height:100vh;">
  <tr><td align="center" style="padding:48px 16px;">
    <table width="520" cellpadding="0" cellspacing="0" style="background:#1E1E1E;border-radius:16px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;max-width:100%;">

      <!-- Header -->
      <tr>
        <td style="padding:32px 40px 24px;border-bottom:1px solid rgba(255,255,255,0.08);">
          <div style="display:flex;align-items:center;gap:8px;">
            <div style="width:8px;height:8px;border-radius:50%;background:#A3E635;display:inline-block;"></div>
            <span style="color:#A3E635;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;">Agência de Atendimento Digital</span>
          </div>
        </td>
      </tr>

      <!-- Body -->
      <tr>
        <td style="padding:36px 40px;">
          <h1 style="color:#FFFFFF;font-size:22px;font-weight:700;margin:0 0 8px;">
            Redefinição de senha
          </h1>
          <p style="color:#9CA3AF;font-size:15px;line-height:1.6;margin:0 0 28px;">
            Olá, <strong style="color:#fff;">${name}</strong>. Recebemos uma solicitação para redefinir a senha da sua conta.
          </p>

          <!-- CTA -->
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td align="center" style="padding-bottom:28px;">
                <a href="${resetUrl}"
                  style="display:inline-block;background:#A3E635;color:#0a0a0a;font-size:15px;font-weight:700;padding:14px 36px;border-radius:10px;text-decoration:none;letter-spacing:-.01em;">
                  Redefinir minha senha →
                </a>
              </td>
            </tr>
          </table>

          <!-- Warning -->
          <div style="background:rgba(163,230,53,0.08);border:1px solid rgba(163,230,53,0.2);border-radius:10px;padding:16px 20px;margin-bottom:24px;">
            <p style="color:#A3E635;font-size:13px;font-weight:600;margin:0 0 4px;">⏱ Este link expira em 1 hora</p>
            <p style="color:#9CA3AF;font-size:13px;margin:0;">Se você não solicitou a redefinição, ignore este e-mail — sua senha permanece a mesma.</p>
          </div>

          <!-- URL fallback -->
          <p style="color:#6B7280;font-size:12px;margin:0 0 4px;">Ou copie e cole este link no navegador:</p>
          <p style="color:#A3E635;font-size:12px;word-break:break-all;margin:0;">
            <a href="${resetUrl}" style="color:#A3E635;text-decoration:none;">${resetUrl}</a>
          </p>
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="color:#4B5563;font-size:12px;margin:0;text-align:center;">
            Agência de Atendimento Digital · Desenvolvido por Agência DIA
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>
  `.trim()
}
