// GET /api/knowledge/search?q=<query>&schema=<tenant_schema>
// Chamado pelo N8N durante atendimentos WhatsApp para injetar contexto no prompt.
// Autenticado via header X-Knowledge-Secret ou query param secret.

import { NextRequest, NextResponse } from 'next/server'
import { ConhecimentoRepository } from '@/lib/repositories/conhecimento.repository'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-knowledge-secret')
    ?? req.nextUrl.searchParams.get('secret')
    ?? ''

  const expectedSecret = process.env.KNOWLEDGE_SECRET ?? ''
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  const q      = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const schema = req.nextUrl.searchParams.get('schema')?.trim() ?? ''
  const limit  = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '5'), 20)

  if (!q || !schema) {
    return NextResponse.json({ success: false, error: 'Parâmetros q e schema são obrigatórios' }, { status: 400 })
  }

  try {
    const repo  = new ConhecimentoRepository(schema)
    const items = await repo.search(q, limit)

    // Formato compacto para injeção no prompt do N8N
    const context = items.map(i =>
      `P: ${i.pergunta}\nR: ${i.resposta}`
    ).join('\n\n')

    return NextResponse.json({ success: true, count: items.length, context, items })
  } catch (err) {
    console.error('[/api/knowledge/search]', err)
    return NextResponse.json({ success: false, error: 'Erro na busca' }, { status: 500 })
  }
}
