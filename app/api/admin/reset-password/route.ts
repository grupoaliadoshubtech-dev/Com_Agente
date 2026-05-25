// app/api/admin/reset-password/route.ts
// POST { email } — redefine senha para a senha padrão de reset (098765)
// Apenas master admin pode usar.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { UsersRepository } from '@/lib/repositories/users.repository'
import bcrypt from 'bcryptjs'

export const dynamic = 'force-dynamic'

const DEFAULT_RESET_PASSWORD = '098765'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user || session.user.role !== 'master') {
    return NextResponse.json({ success: false, error: 'Acesso negado' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const email = String(body.email ?? '').trim()
  if (!email) {
    return NextResponse.json({ success: false, error: 'E-mail obrigatório' }, { status: 400 })
  }

  try {
    const hash = await bcrypt.hash(DEFAULT_RESET_PASSWORD, 10)
    const repo = new UsersRepository()
    const found = await repo.resetPassword(email, hash)

    if (!found) {
      return NextResponse.json({ success: false, error: `Usuário não encontrado: ${email}` }, { status: 404 })
    }

    return NextResponse.json({ success: true, message: `Senha redefinida para ${email}` })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
