// POST /api/knowledge/import
// Recebe Q&As processados pelo N8N após análise do documento com IA.
// Autenticado via header X-Knowledge-Secret.
//
// Segurança multi-tenant:
//   O N8N envia o TOKEN que recebeu no upload — nunca o schema diretamente.
//   Este endpoint resolve o schema a partir do token no banco (app.knowledge_nonces),
//   consome o token (uso único) e só então grava na tabela do tenant correto.
//   Tokens expirados (> 10 min) são rejeitados automaticamente.
//
// Body: { token: string, items: [{pergunta, resposta, categoria?}] }

import { NextRequest, NextResponse } from 'next/server'
import { query, execute } from '@/lib/supabase/client'
import { ConhecimentoRepository } from '@/lib/repositories/conhecimento.repository'

interface ImportItem {
  pergunta:   string
  resposta:   string
  categoria?: string
}

interface ImportBody {
  token: string
  items: ImportItem[]
}

export async function POST(req: NextRequest) {
  // ── Autenticação do N8N ───────────────────────────────────────
  const secret         = req.headers.get('x-knowledge-secret') ?? ''
  const expectedSecret = process.env.KNOWLEDGE_SECRET ?? ''
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  let body: ImportBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  if (!body.token?.trim()) {
    return NextResponse.json({ success: false, error: 'Campo token obrigatório' }, { status: 422 })
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ success: false, error: 'Campo items deve ser um array não vazio' }, { status: 422 })
  }

  // ── Resolve o schema a partir do nonce ───────────────────────
  // Rejeita tokens expirados ou inexistentes.
  const nonces = await query(
    `SELECT schema FROM app.knowledge_nonces
     WHERE token = $1 AND expires_at > NOW()`,
    [body.token.trim()]
  )

  if (nonces.length === 0) {
    console.warn(`[/api/knowledge/import] Token inválido ou expirado: ${body.token}`)
    return NextResponse.json(
      { success: false, error: 'Token inválido ou expirado' },
      { status: 401 }
    )
  }

  const schema = String(nonces[0].schema)

  // ── Consome o token — uso único ───────────────────────────────
  await execute(
    `DELETE FROM app.knowledge_nonces WHERE token = $1`,
    [body.token.trim()]
  )

  // Limpa também nonces expirados de outros uploads anteriores
  execute(`DELETE FROM app.knowledge_nonces WHERE expires_at <= NOW()`).catch(() => {})

  // ── Valida e grava os itens no schema correto ─────────────────
  const validItems = body.items.filter(
    i => typeof i.pergunta === 'string' && i.pergunta.trim() &&
         typeof i.resposta === 'string' && i.resposta.trim()
  )

  if (validItems.length === 0) {
    return NextResponse.json({ success: false, error: 'Nenhum item válido encontrado' }, { status: 422 })
  }

  try {
    const repo  = new ConhecimentoRepository(schema)
    const count = await repo.bulkCreate(validItems)
    console.log(`[/api/knowledge/import] schema=${schema} importados=${count}/${body.items.length}`)
    return NextResponse.json({ success: true, imported: count, total: body.items.length })
  } catch (err) {
    console.error('[/api/knowledge/import]', err)
    return NextResponse.json({ success: false, error: 'Erro ao importar itens' }, { status: 500 })
  }
}
