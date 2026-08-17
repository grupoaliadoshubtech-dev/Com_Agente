// POST /api/knowledge/import
// Recebe Q&As processados pelo N8N (após análise do documento com IA).
// Autenticado via header X-Knowledge-Secret.
// Body: { schema: string, items: [{pergunta, resposta, categoria?}] }

import { NextRequest, NextResponse } from 'next/server'
import { ConhecimentoRepository } from '@/lib/repositories/conhecimento.repository'

interface ImportItem {
  pergunta:  string
  resposta:  string
  categoria?: string
}

interface ImportBody {
  schema:  string
  items:   ImportItem[]
  secret?: string
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-knowledge-secret')
    ?? ''

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

  if (!body.schema?.trim()) {
    return NextResponse.json({ success: false, error: 'Campo schema obrigatório' }, { status: 422 })
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return NextResponse.json({ success: false, error: 'Campo items deve ser um array não vazio' }, { status: 422 })
  }

  const validItems = body.items.filter(
    i => typeof i.pergunta === 'string' && i.pergunta.trim() &&
         typeof i.resposta === 'string' && i.resposta.trim()
  )

  if (validItems.length === 0) {
    return NextResponse.json({ success: false, error: 'Nenhum item válido encontrado' }, { status: 422 })
  }

  try {
    const repo  = new ConhecimentoRepository(body.schema.trim())
    const count = await repo.bulkCreate(validItems)
    console.log(`[/api/knowledge/import] schema=${body.schema} importados=${count}/${body.items.length}`)
    return NextResponse.json({ success: true, imported: count, total: body.items.length })
  } catch (err) {
    console.error('[/api/knowledge/import]', err)
    return NextResponse.json({ success: false, error: 'Erro ao importar itens' }, { status: 500 })
  }
}
