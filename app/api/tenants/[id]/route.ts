// app/api/tenants/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { TenantsRepository } from '@/lib/repositories/plans-tenants-leads.repository'
import { z } from 'zod'

const repo = new TenantsRepository()
const PatchSchema = z.object({ status: z.enum(['active', 'trial', 'inactive']) })

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'master')
    return NextResponse.json({ success: false, error: 'Apenas Master Admin' }, { status: 403 })
  try {
    const body   = await req.json()
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ success: false, error: 'Status inválido' }, { status: 422 })
    await repo.updateStatus(params.id, parsed.data.status)
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
