// app/api/tenants/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { TenantsRepository } from '@/lib/repositories/plans-tenants-leads.repository'
import { z } from 'zod'

import bcrypt from 'bcryptjs'
import { UsersRepository } from '@/lib/repositories/users.repository'

const repo      = new TenantsRepository()
const usersRepo = new UsersRepository()

const StatusSchema = z.object({
  action: z.literal('status'),
  status: z.enum(['active', 'trial', 'inactive']),
})

const EditSchema = z.object({
  action:            z.literal('edit'),
  name:              z.string().min(2),
  email:             z.string().email(),
  phone:             z.string(),
  planId:            z.string(),
  status:            z.enum(['active', 'trial', 'inactive']),
  evolutionInstance: z.string(),
  masterPassword:    z.string().min(1, 'Senha obrigatória'),
})

const PatchSchema = z.discriminatedUnion('action', [StatusSchema, EditSchema])

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'master')
    return NextResponse.json({ success: false, error: 'Apenas Master Admin' }, { status: 403 })
  try {
    const body   = await req.json()
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ success: false, error: 'Dados inválidos' }, { status: 422 })

    if (parsed.data.action === 'status') {
      await repo.updateStatus(params.id, parsed.data.status)
      return NextResponse.json({ success: true })
    }

    // Ação 'edit' — valida senha do Master antes de salvar
    const master = await usersRepo.findById(session.user.id)
    if (!master) return NextResponse.json({ success: false, error: 'Usuário não encontrado' }, { status: 404 })

    const pwOk = await bcrypt.compare(parsed.data.masterPassword, master.passwordHash)
    if (!pwOk) return NextResponse.json({ success: false, error: 'Senha incorreta', field: 'masterPassword' }, { status: 400 })

    const { action, masterPassword, ...fields } = parsed.data
    await repo.updateTenant(params.id, fields)
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'master')
    return NextResponse.json({ success: false, error: 'Apenas Master Admin' }, { status: 403 })
  try {
    const tenant = await repo.findById(params.id)
    if (!tenant) return NextResponse.json({ success: false, error: 'Tenant não encontrado' }, { status: 404 })
    return NextResponse.json({ success: true, data: tenant })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
