// app/api/dashboard/export/route.ts
// FASE 7 — Exporta relatório de atendimentos como CSV
// GET /api/dashboard/export?periodo=7d|30d|all

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { AtendimentosRepository, SatisfacaoRepository } from '@/lib/repositories/analytics.repository'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  if (session.user.role === 'atendente') {
    return NextResponse.json({ error: 'Apenas supervisor ou master' }, { status: 403 })
  }

  const periodo = req.nextUrl.searchParams.get('periodo') ?? '30d'
  const tipo = req.nextUrl.searchParams.get('tipo') ?? 'atendimentos'

  try {
    const tid = session.user.tenantId
    let csv = ''

    if (tipo === 'atendimentos') {
      const repo = new AtendimentosRepository(tid)
      const all = await repo.findAll()

      // Filtra por período
      let filtered = all
      if (periodo !== 'all') {
        const days = parseInt(periodo) || 30
        const since = new Date(Date.now() - days * 86400000).toISOString()
        filtered = all.filter(a => a.inicio >= since)
      }

      csv = 'ID,Telefone,Nome,Inicio,Fim,Duracao,Atendente,Satisfacao\n'
      for (const a of filtered) {
        csv += `${a.id},${a.telefone},"${a.nome}",${a.inicio},${a.fim ?? ''},${a.duracao ?? ''},${a.atendente},${a.satisfacao ?? ''}\n`
      }
    } else if (tipo === 'satisfacao') {
      const repo = new SatisfacaoRepository(tid)
      const all = await repo.findAll()

      let filtered = all
      if (periodo !== 'all') {
        const days = parseInt(periodo) || 30
        const since = new Date(Date.now() - days * 86400000).toISOString()
        filtered = all.filter(s => s.timestamp >= since)
      }

      csv = 'Timestamp,Telefone,Nota,AtendimentoID,Atendente\n'
      for (const s of filtered) {
        csv += `${s.timestamp},${s.telefone},${s.nota},${s.atendimentoId},${s.atendente}\n`
      }
    }

    const filename = `comagente-${tipo}-${periodo}-${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[/api/dashboard/export]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
