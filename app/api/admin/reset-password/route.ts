// app/api/admin/reset-password/route.ts
// POST { email } — redefine senha para senha aleatória de 8 caracteres
// Apenas master admin pode usar.
// Aciona Pausar Global automaticamente por segurança.
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { UsersRepository } from '@/lib/repositories/users.repository'
import { HandoffRepository } from '@/lib/repositories/handoff.repository'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'

export const dynamic = 'force-dynamic'

function generateResetPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  const bytes = randomBytes(8)
  return Array.from(bytes).map(b => chars[b % chars.length]).join('')
}

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
    const repo = new UsersRepository()

    // Busca o usuário antes para obter o tenantId
    const user = await repo.findByEmail(email)
    if (!user) {
      return NextResponse.json({ success: false, error: 'Usuário não encontrado' }, { status: 404 })
    }

    const tempPassword = generateResetPassword()
    const hash = await bcrypt.hash(tempPassword, 10)
    await repo.resetPassword(email, hash)

    // Aciona Pausar Global no tenant do usuário — segurança obrigatória
    if (user.tenantId) {
      try {
        const handoff = new HandoffRepository(user.tenantId)
        await handoff.pausaGlobal(`master:${session.user.email}`)
      } catch { /* não bloqueia o reset se handoff falhar */ }
    }

    return NextResponse.json({ success: true, message: `Senha redefinida para ${email}`, tempPassword })
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}
