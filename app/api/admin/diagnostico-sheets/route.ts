// app/api/admin/diagnostico-sheets/route.ts — master only
// GET → lista todas as abas da planilha master e testa escrita em Usuarios

import { NextResponse }   from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }    from '@/lib/auth'
import { getSheetsClient } from '@/lib/sheets/client'
import type { ApiResponse } from '@/types'

const MASTER_ID = process.env.GOOGLE_MASTER_SHEET_ID!

export async function GET(): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'master') {
    return NextResponse.json({ success: false, error: 'Apenas Master Admin' }, { status: 403 })
  }

  try {
    const sheets = getSheetsClient()

    // Lista todas as abas
    const meta = await sheets.spreadsheets.get({
      spreadsheetId: MASTER_ID,
      fields: 'sheets.properties',
    })

    const abas = meta.data.sheets?.map(s => ({
      id:    s.properties?.sheetId,
      title: s.properties?.title,
      index: s.properties?.index,
    })) ?? []

    // Tenta ler a primeira célula de cada aba relevante
    const checks: Record<string, unknown> = {}
    for (const nome of ['Empresas', 'Usuarios', 'Leads', 'Planos']) {
      try {
        const r = await sheets.spreadsheets.values.get({
          spreadsheetId: MASTER_ID,
          range: `${nome}!A1`,
        })
        checks[nome] = { ok: true, a1: r.data.values?.[0]?.[0] ?? '(vazio)' }
      } catch (e) {
        checks[e instanceof Error ? e.message : String(e)] = { ok: false, sheet: nome }
        checks[nome] = { ok: false, erro: e instanceof Error ? e.message : String(e) }
      }
    }

    return NextResponse.json({
      success: true,
      data: { masterSheetId: MASTER_ID?.slice(0, 8) + '...', abas, checks },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
