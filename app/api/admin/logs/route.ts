// app/api/admin/logs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { LogErrosRepository } from '@/lib/repositories/admin.repository'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (session?.user?.role !== 'master')
    return NextResponse.json({ success: false, error: 'Apenas Master Admin' }, { status: 403 })

  const tenantId = req.nextUrl.searchParams.get('tenantId')
  const repo     = new LogErrosRepository()

  try {
    const [data, stats] = await Promise.all([
      tenantId ? repo.findByTenant(tenantId) : repo.findAll(),
      repo.getStats(),
    ])
    return NextResponse.json({ success: true, data: { records: data, stats } })
  } catch (err) {
    return NextResponse.json({ success: false, error: 'Erro interno. Tente novamente.' }, { status: 500 })
  }
}
