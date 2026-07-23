import { NextRequest, NextResponse } from 'next/server'
import { UsersRepository } from '@/lib/repositories/users.repository'

const SECRET = process.env.DEBUG_SECRET ?? 'comagente-debug-2026'

// GET temporário — diagnóstico: lista usuários sem senha
// Acesso: /api/debug/users?secret=comagente-debug-2026
export async function GET(req: NextRequest): Promise<NextResponse> {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== SECRET) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  const repo  = new UsersRepository()
  const users = await repo.findAll()

  return NextResponse.json(users.map(u => ({
    id:      u.id,
    email:   u.email,
    name:    u.name,
    role:    u.role,
    isActive: u.isActive,
  })))
}
