// app/api/templates/route.ts
// FASE 5 — CRUD de respostas rápidas/templates
// GET: lista todos | POST: cria novo | PUT: atualiza | DELETE: remove

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { TemplatesRepository } from '@/lib/repositories/templates.repository'
import { z } from 'zod'
import type { ApiResponse } from '@/types'

export const dynamic = 'force-dynamic'

// ── GET: Listar templates ────────────────────────────────────
export async function GET(): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const repo = new TemplatesRepository(session.user.tenantId)
    const templates = await repo.findAll()
    return NextResponse.json({ success: true, data: templates })
  } catch (err) {
    console.error('[/api/templates GET]', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}

// ── POST: Criar template (supervisor/master) ─────────────────
const CreateSchema = z.object({
  atalho:    z.string().min(2).max(30),
  titulo:    z.string().min(2).max(60),
  mensagem:  z.string().min(1).max(2000),
  categoria: z.string().max(30).optional(),
})

export async function POST(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }
  if (session.user.role === 'atendente') {
    return NextResponse.json({ success: false, error: 'Apenas supervisor ou master' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Dados inválidos' }, { status: 422 })
  }

  try {
    const repo = new TemplatesRepository(session.user.tenantId)

    // Verifica se atalho já existe
    const existing = await repo.findByAtalho(parsed.data.atalho)
    if (existing) {
      return NextResponse.json({ success: false, error: `Atalho "${parsed.data.atalho}" já existe` }, { status: 409 })
    }

    const template = await repo.create({
      ...parsed.data,
      criadoPor: session.user.id,
    })

    return NextResponse.json({ success: true, data: template, message: 'Template criado' })
  } catch (err) {
    console.error('[/api/templates POST]', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}

// ── PUT: Atualizar template (supervisor/master) ──────────────
const UpdateSchema = z.object({
  id:        z.string().min(1),
  atalho:    z.string().min(2).max(30).optional(),
  titulo:    z.string().min(2).max(60).optional(),
  mensagem:  z.string().min(1).max(2000).optional(),
  categoria: z.string().max(30).optional(),
})

export async function PUT(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }
  if (session.user.role === 'atendente') {
    return NextResponse.json({ success: false, error: 'Apenas supervisor ou master' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = UpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Dados inválidos' }, { status: 422 })
  }

  try {
    const repo = new TemplatesRepository(session.user.tenantId)
    const { id, ...updates } = parsed.data
    await repo.update(id, updates)
    return NextResponse.json({ success: true, message: 'Template atualizado' })
  } catch (err) {
    console.error('[/api/templates PUT]', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}

// ── DELETE: Remover template (soft delete) ───────────────────
export async function DELETE(req: NextRequest): Promise<NextResponse<ApiResponse>> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ success: false, error: 'Não autorizado' }, { status: 401 })
  }
  if (session.user.role === 'atendente') {
    return NextResponse.json({ success: false, error: 'Apenas supervisor ou master' }, { status: 403 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) {
    return NextResponse.json({ success: false, error: 'ID obrigatório' }, { status: 400 })
  }

  try {
    const repo = new TemplatesRepository(session.user.tenantId)
    await repo.delete(id)
    return NextResponse.json({ success: true, message: 'Template removido' })
  } catch (err) {
    console.error('[/api/templates DELETE]', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
