import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { UsersRepository } from '@/lib/repositories/users.repository'
import bcrypt from 'bcryptjs'
import { z } from 'zod'

const repo = new UsersRepository()

// GET — retorna nome e avatarUrl do usuário logado
export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })

  const user = await repo.findById(session.user.id)
  if (!user) return NextResponse.json({ success: false, error: 'Usuário não encontrado' }, { status: 404 })

  return NextResponse.json({ success: true, data: { name: user.name, avatarUrl: user.avatarUrl ?? '' } })
}

// POST — verifica se a senha atual está correta (para feedback em tempo real)
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ valid: false }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ valid: false }) }

  const { currentPassword } = body as { currentPassword?: string }
  if (!currentPassword) return NextResponse.json({ valid: false })

  const user = await repo.findById(session.user.id)
  if (!user) return NextResponse.json({ valid: false })

  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  return NextResponse.json({ valid })
}

const PatchSchema = z.object({
  name:            z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(60).optional(),
  currentPassword: z.string().optional(),
  newPassword:     z.string().min(6, 'A senha deve ter no mínimo 6 caracteres').max(20).optional(),
  confirmPassword: z.string().optional(),
  avatarUrl:       z.string().optional(),
}).refine(d => !d.newPassword || !!d.currentPassword, {
  message: 'Informe a senha atual para definir uma nova',
  path: ['currentPassword'],
}).refine(d => !d.newPassword || d.newPassword === d.confirmPassword, {
  message: 'As senhas não coincidem',
  path: ['confirmPassword'],
})

// PATCH — atualiza perfil (nome, senha, avatar)
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    const msg = Object.values(parsed.error.flatten().fieldErrors).flat()[0] ?? 'Dados inválidos'
    return NextResponse.json({ success: false, error: msg }, { status: 422 })
  }

  const { name, currentPassword, newPassword, avatarUrl } = parsed.data

  const user = await repo.findById(session.user.id)
  if (!user) return NextResponse.json({ success: false, error: 'Usuário não encontrado' }, { status: 404 })

  const update: { name?: string; passwordHash?: string; avatarUrl?: string } = {}

  if (name !== undefined) update.name = name.trim()

  if (newPassword) {
    const match = await bcrypt.compare(currentPassword!, user.passwordHash)
    if (!match) return NextResponse.json({ success: false, error: 'Senha atual incorreta', field: 'currentPassword' }, { status: 400 })
    update.passwordHash = await bcrypt.hash(newPassword, 12)
  }

  if (avatarUrl !== undefined) update.avatarUrl = avatarUrl

  if (Object.keys(update).length === 0)
    return NextResponse.json({ success: false, error: 'Nenhuma modificação foi feita' }, { status: 400 })

  const ok = await repo.updateProfile(session.user.id, update)
  if (!ok) return NextResponse.json({ success: false, error: 'Erro ao salvar' }, { status: 500 })

  return NextResponse.json({ success: true, data: { name: update.name ?? user.name } })
}
