// app/api/admin/sheet-inspect/route.ts — master only, diagnóstico temporário
// GET ?sheetId=<spreadsheetId>&tab=Agendamento
// Retorna as primeiras 5 linhas da aba para mapear a estrutura de colunas.

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession }          from 'next-auth'
import { authOptions }               from '@/lib/auth'
import { readRange }                 from '@/lib/sheets/client'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'master') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const sheetId = searchParams.get('sheetId') || process.env.GOOGLE_MASTER_SHEET_ID || ''
  const tab     = searchParams.get('tab') || 'Agendamento'

  if (!sheetId) {
    return NextResponse.json({ error: 'sheetId não informado' }, { status: 400 })
  }

  try {
    const rows = await readRange(sheetId, `${tab}!A1:Z5`)
    return NextResponse.json({
      sheetId,
      tab,
      totalLinhas: rows.length,
      headers: rows[0] ?? [],
      amostra: rows.slice(1),
    })
  } catch (err: unknown) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Erro ao ler planilha',
    }, { status: 500 })
  }
}
