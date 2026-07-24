// ─────────────────────────────────────────────────────────────
// app/api/auth/reset-password/route.ts
//
// POST /api/auth/reset-password
// Body: { token: string; password: string }
//
// Fluxo:
// 1. Verifica token (existe, não expirado, não usado)
// 2. Valida nova senha (mín. 8 chars)
// 3. Faz hash bcrypt da nova senha
// 4. Atualiza passwordHash do usuário no Sheets
// 5. Marca token como consumido (sem reuso)
// ─────────────────────────────────────────────────────────────

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { ResetTokenRepository } from '@/lib/repositories/reset-token.repository'
import { UsersRepository }      from '@/lib/repositories/users.repository'
import { readRange, updateRange } from '@/lib/sheets/client'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const MASTER_ID = process.env.GOOGLE_MASTER_SHEET_ID!

const Schema = z.object({
  token:    z.string().length(64),
  password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres'),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 10 tentativas por IP a cada hora
  const rl = await rateLimit(`reset:${getClientIp(req)}`, 10, 60 * 60)
  if (!rl.allowed) {
    return NextResponse.json({ success: false, error: 'Muitas tentativas. Tente novamente mais tarde.' }, { status: 429 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ success: false, error: 'Body inválido' }, { status: 400 })
  }

  const parsed = Schema.safeParse(body)
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors.password?.[0] ?? 'Dados inválidos'
    return NextResponse.json({ success: false, error: msg }, { status: 422 })
  }

  const { token, password } = parsed.data
  const tokenRepo = new ResetTokenRepository()

  // 1. Verifica token
  const record = await tokenRepo.verify(token)
  if (!record) {
    return NextResponse.json({
      success: false,
      error:   'Link inválido ou expirado. Solicite um novo link de redefinição.',
    }, { status: 400 })
  }

  try {
    // 2. Hash da nova senha
    const passwordHash = await bcrypt.hash(password, 12)

    // 3. Atualiza no Sheets — coluna D (passwordHash) da aba Usuarios
    //    Localiza linha pelo userId
    const rows = await readRange(MASTER_ID, 'Usuarios!A:M')
    if (rows.length < 2) throw new Error('Aba Usuarios vazia')

    const headers  = rows[0]
    const idCol    = headers.indexOf('id')
    const hashCol  = headers.indexOf('passwordHash')
    const rowIndex = rows.findIndex((r, i) => i > 0 && r[idCol] === record.userId)

    if (rowIndex === -1) throw new Error('Usuário não encontrado')

    const sheetRow  = rowIndex + 1
    const colLetter = String.fromCharCode(65 + hashCol)  // D = índice 3

    await updateRange(MASTER_ID, `Usuarios!${colLetter}${sheetRow}`, [[passwordHash]])

    // 4. Marca token como consumido
    await tokenRepo.consume(token)

    return NextResponse.json({
      success: true,
      message: 'Senha redefinida com sucesso! Faça login com a nova senha.',
    })
  } catch (err) {
    console.error('[reset-password]', err)
    return NextResponse.json({
      success: false,
      error:   'Erro interno ao redefinir senha. Tente novamente.',
    }, { status: 500 })
  }
}

// GET — verifica se o token ainda é válido (usado pelo front para mostrar o form)
export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) {
    return NextResponse.json({ success: false, error: 'Token ausente' }, { status: 400 })
  }

  const tokenRepo = new ResetTokenRepository()
  const record    = await tokenRepo.verify(token)

  if (!record) {
    return NextResponse.json({
      success: false,
      error:   'Link inválido ou expirado.',
      expired: true,
    }, { status: 400 })
  }

  return NextResponse.json({
    success:   true,
    email:     record.email,
    expiresAt: record.expiresAt,
  })
}
