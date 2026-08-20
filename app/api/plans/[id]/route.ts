// app/api/plans/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { execute, queryOne } from '@/lib/supabase/db'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'master')
    return NextResponse.json({ success: false, error: 'Apenas Master Admin' }, { status: 403 })

  try {
    const body = await req.json()
    const current = await queryOne('SELECT * FROM app.planos WHERE id = $1', [params.id])
    if (!current) return NextResponse.json({ success: false, error: 'Plano não encontrado' }, { status: 404 })

    const sets: string[]  = []
    const vals: unknown[] = []
    let   idx             = 1

    if (body.name          !== undefined) { sets.push(`name = $${idx++}`);           vals.push(body.name) }
    if (body.price         !== undefined) { sets.push(`price = $${idx++}`);          vals.push(body.price) }
    if (body.period        !== undefined) { sets.push(`period = $${idx++}`);         vals.push(body.period) }
    if (body.maxInstances  !== undefined) { sets.push(`max_instances = $${idx++}`);  vals.push(body.maxInstances) }
    if (body.maxAttendants !== undefined) { sets.push(`max_attendants = $${idx++}`); vals.push(body.maxAttendants) }
    if (body.maxMessages   !== undefined) { sets.push(`max_messages = $${idx++}`);   vals.push(body.maxMessages ?? null) }
    if (body.setupFeePct   !== undefined) { sets.push(`setup_fee_pct = $${idx++}`);  vals.push(Number(body.setupFeePct) || 100) }
    if (body.features      !== undefined) { sets.push(`features = $${idx++}`);       vals.push(JSON.stringify(body.features)) }
    if (body.isActive      !== undefined) { sets.push(`is_active = $${idx++}`);      vals.push(body.isActive) }

    if (sets.length === 0) return NextResponse.json({ success: true })
    vals.push(params.id)
    await execute(`UPDATE app.planos SET ${sets.join(', ')} WHERE id = $${idx}`, vals)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[/api/plans PATCH]', err)
    return NextResponse.json({ success: false, error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}
