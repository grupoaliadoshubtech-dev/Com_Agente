// app/api/admin/blacklist/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { GlobalBlacklistRepository } from '@/lib/repositories/admin.repository'
import { z } from 'zod'

const repo = new GlobalBlacklistRepository()

export async function GET() {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'master')
    return NextResponse.json({ success: false, error: 'Apenas Master Admin' }, { status: 403 })
  try {
    const data = await repo.findAll()
    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}

const AddSchema = z.object({
  telefone: z.string().min(8),
  motivo:   z.string().default('Bloqueado pelo Master Admin'),
})

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'master')
    return NextResponse.json({ success: false, error: 'Apenas Master Admin' }, { status: 403 })
  try {
    const body   = await req.json()
    const parsed = AddSchema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json({ success: false, error: 'Dados inválidos' }, { status: 422 })
    await repo.addGlobal(parsed.data.telefone, parsed.data.motivo, session.user.id)
    return NextResponse.json({ success: true, message: `${parsed.data.telefone} bloqueado globalmente` }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}
