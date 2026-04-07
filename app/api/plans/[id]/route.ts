// app/api/plans/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { readRange, updateRange, rowsToObjects } from '@/lib/sheets/client'

const MASTER_ID = process.env.GOOGLE_MASTER_SHEET_ID!
const SHEET = 'Planos'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'master')
    return NextResponse.json({ success: false, error: 'Apenas Master Admin' }, { status: 403 })

  try {
    const body = await req.json()
    const rows = await readRange(MASTER_ID, `${SHEET}!A:H`)
    if (rows.length < 2) return NextResponse.json({ success: false, error: 'Plano não encontrado' }, { status: 404 })

    const headers  = rows[0]
    const idCol    = headers.indexOf('id')
    const rowIndex = rows.findIndex((r, i) => i > 0 && r[idCol] === params.id)
    if (rowIndex === -1) return NextResponse.json({ success: false, error: 'Plano não encontrado' }, { status: 404 })

    const sheetRow  = rowIndex + 1
    const current   = rowsToObjects<Record<string, string>>([rows[0], rows[rowIndex]])[0]

    // Merge body com valores atuais
    const updated = [
      current.id,
      body.name          ?? current.name,
      body.price         ?? current.price,
      body.period        ?? current.period,
      body.maxInstances  ?? current.maxInstances,
      body.maxAttendants ?? current.maxAttendants,
      body.features      ? JSON.stringify(body.features) : current.features,
      body.isActive      !== undefined ? body.isActive : current.isActive,
    ]

    await updateRange(MASTER_ID, `${SHEET}!A${sheetRow}:H${sheetRow}`, [updated])
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
