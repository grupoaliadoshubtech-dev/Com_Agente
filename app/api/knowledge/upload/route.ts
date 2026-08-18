// POST /api/knowledge/upload
// Recebe arquivo (multipart) do supervisor, encaminha ao N8N para processamento com IA.
// Segurança: gera um nonce de uso único vinculado ao schema do tenant.
// O N8N recebe apenas o token — nunca o nome do schema.
// Após processar, N8N devolve o token via POST /api/knowledge/import,
// que resolve o schema internamente e descarta o token.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { execute, query } from '@/lib/supabase/client'
import type { ApiResponse } from '@/types'

const ALLOWED_TYPES = [
  'application/pdf',
  'text/plain',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]
const MAX_SIZE = 25 * 1024 * 1024 // 25 MB

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }
  const role = session.user.role as string
  if (role !== 'supervisor' && role !== 'master') {
    return NextResponse.json({ success: false, error: 'Acesso restrito ao supervisor' }, { status: 403 })
  }

  const webhookUrl = process.env.N8N_KNOWLEDGE_WEBHOOK_URL
  if (!webhookUrl) {
    return NextResponse.json(
      { success: false, error: 'Webhook N8N não configurado (N8N_KNOWLEDGE_WEBHOOK_URL)' },
      { status: 503 }
    )
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ success: false, error: 'Formato inválido — use multipart/form-data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ success: false, error: 'Arquivo não encontrado no campo "file"' }, { status: 422 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ success: false, error: 'Arquivo maior que 25 MB' }, { status: 413 })
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { success: false, error: 'Tipo de arquivo não suportado. Use PDF, TXT, imagem ou DOCX.' },
      { status: 415 }
    )
  }

  // ── Gera nonce vinculado ao schema do tenant autenticado ──────
  // O schema nunca é enviado ao N8N — apenas o token de uso único.
  const schema = session.user.tenantId
  const token  = crypto.randomUUID()

  try {
    await execute(
      `INSERT INTO app.knowledge_nonces (token, schema) VALUES ($1, $2)`,
      [token, schema]
    )
  } catch (err) {
    console.error('[/api/knowledge/upload] Erro ao gravar nonce:', err)
    return NextResponse.json({ success: false, error: 'Erro interno ao preparar upload' }, { status: 500 })
  }

  // ── Monta payload para o N8N — sem expor o schema ────────────
  const appUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? ''
  const secret = process.env.KNOWLEDGE_SECRET ?? ''

  const payload = new FormData()
  payload.append('file',        file, file.name)
  payload.append('token',       token)          // ← apenas o token, sem schema
  payload.append('fileName',    file.name)
  payload.append('fileType',    file.type)
  payload.append('callbackUrl', `${appUrl}/api/knowledge/import`)
  payload.append('secret',      secret)

  try {
    const n8nRes = await fetch(webhookUrl, {
      method: 'POST',
      body:   payload,
      signal: AbortSignal.timeout(30_000),
    })

    if (!n8nRes.ok) {
      // Se o N8N falhou, remove o nonce para não deixar token órfão
      await execute(`DELETE FROM app.knowledge_nonces WHERE token = $1`, [token]).catch(() => {})
      const txt = await n8nRes.text().catch(() => '')
      console.error('[/api/knowledge/upload] N8N respondeu com erro:', n8nRes.status, txt)
      return NextResponse.json(
        { success: false, error: 'N8N retornou erro ao processar o arquivo' },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Arquivo "${file.name}" enviado para processamento. As perguntas e respostas aparecerão em instantes.`,
    })
  } catch (err) {
    await execute(`DELETE FROM app.knowledge_nonces WHERE token = $1`, [token]).catch(() => {})
    console.error('[/api/knowledge/upload]', err)
    return NextResponse.json(
      { success: false, error: 'Falha ao conectar com o N8N — verifique o webhook configurado.' },
      { status: 502 }
    )
  }
}
