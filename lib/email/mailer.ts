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

export function diagnosticoTemplate(name: string, company: string, url: string): string {
  const firstName = name.split(' ')[0]
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#0f1117;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:28px;font-weight:900;color:#ffffff;font-family:Arial,sans-serif;">Com</span><span style="font-size:28px;font-weight:900;color:#a3e635;">Agente</span>
    </div>
    <div style="background:#1a1d27;border-radius:16px;padding:32px 28px;border:1px solid rgba(255,255,255,.08);">
      <p style="color:#f0f0f0;font-size:15px;margin:0 0 16px;">Olá, ${firstName}!</p>
      <p style="color:#9ca3af;font-size:14px;line-height:1.7;margin:0 0 12px;">
        Recebemos o cadastro da <strong style="color:#f0f0f0;">${company}</strong> e estamos animados para começar.
      </p>
      <p style="color:#9ca3af;font-size:14px;line-height:1.7;margin:0 0 28px;">
        Para que possamos personalizar sua IA de atendimento com precisão, preparamos um breve diagnóstico sobre o seu negócio. Leva apenas alguns minutos e faz toda a diferença na qualidade do seu agente.
      </p>
      <div style="text-align:center;margin-bottom:28px;">
        <a href="${url}" style="display:inline-block;background:#a3e635;color:#0a0a0a;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:10px;">
          Responder Diagnóstico →
        </a>
      </div>
      <p style="color:#6b7280;font-size:12px;line-height:1.6;margin:0;border-top:1px solid rgba(255,255,255,.06);padding-top:20px;">
        Se o botão não funcionar, copie e cole este link no seu navegador:<br>
        <a href="${url}" style="color:#a3e635;word-break:break-all;">${url}</a>
      </p>
    </div>
    <p style="text-align:center;color:#4b5563;font-size:11px;margin-top:24px;">
      © ${new Date().getFullYear()} ComAgente · Todos os direitos reservados
    </p>
  </div>
</body>
</html>
  `.trim()
}

export function aprovacaoTemplate(name: string, company: string, email: string, senha: string, loginUrl: string): string {
  const firstName = name.split(' ')[0]
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:28px;font-weight:900;color:#ffffff;">Com</span><span style="font-size:28px;font-weight:900;color:#a3e635;">Agente</span>
    </div>
    <div style="background:#1a1d27;border-radius:16px;padding:32px 28px;border:1px solid rgba(255,255,255,.08);">
      <div style="text-align:center;margin-bottom:24px;">
        <span style="display:inline-block;background:#a3e63520;border:1px solid #a3e63540;color:#a3e635;font-size:12px;font-weight:700;padding:6px 16px;border-radius:100px;letter-spacing:.05em;">✓ CONTA APROVADA</span>
      </div>
      <p style="color:#f0f0f0;font-size:15px;margin:0 0 16px;">Olá, ${firstName}!</p>
      <p style="color:#9ca3af;font-size:14px;line-height:1.7;margin:0 0 24px;">
        A conta da <strong style="color:#f0f0f0;">${company}</strong> foi aprovada. Seu acesso à plataforma está pronto.
      </p>
      <div style="background:#0f1117;border-radius:10px;padding:20px;margin-bottom:24px;border:1px solid rgba(255,255,255,.06);">
        <p style="color:#6b7280;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;margin:0 0 12px;">Suas credenciais de acesso</p>
        <div style="margin-bottom:10px;">
          <span style="color:#6b7280;font-size:12px;">Login (e-mail)</span><br>
          <span style="color:#f0f0f0;font-size:14px;font-weight:600;">${email}</span>
        </div>
        <div>
          <span style="color:#6b7280;font-size:12px;">Senha provisória</span><br>
          <span style="color:#a3e635;font-size:18px;font-weight:800;letter-spacing:.12em;">${senha}</span>
        </div>
      </div>
      <div style="text-align:center;margin-bottom:24px;">
        <a href="${loginUrl}" style="display:inline-block;background:#a3e635;color:#0a0a0a;text-decoration:none;font-size:15px;font-weight:700;padding:14px 32px;border-radius:10px;">
          Acessar a Plataforma →
        </a>
      </div>
      <p style="color:#6b7280;font-size:12px;line-height:1.6;margin:0;border-top:1px solid rgba(255,255,255,.06);padding-top:20px;">
        Por segurança, altere sua senha no primeiro acesso.<br>
        Se o botão não funcionar, acesse: <a href="${loginUrl}" style="color:#a3e635;">${loginUrl}</a>
      </p>
    </div>
    <p style="text-align:center;color:#4b5563;font-size:11px;margin-top:24px;">
      © ${new Date().getFullYear()} ComAgente · Todos os direitos reservados
    </p>
  </div>
</body>
</html>`.trim()
}

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
