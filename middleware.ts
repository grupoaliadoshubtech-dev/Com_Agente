// ─────────────────────────────────────────────────────────────
// middleware.ts  (raiz do projeto)
// RBAC via JWT — protege rotas por role.
// Executa no Edge Runtime (sem acesso ao Node.js completo).
// ─────────────────────────────────────────────────────────────

import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { UserRole } from '@/types'

// ── Mapa de rotas → roles permitidos ─────────────────────────
const ROLE_MAP: Record<string, UserRole[]> = {
  // Master exclusivo
  '/admin':                      ['master'],
  '/admin/empresas':             ['master'],
  '/admin/planos':               ['master'],
  '/admin/blacklist':            ['master'],
  '/admin/logs':                 ['master'],

  // Supervisor (gerencia seu tenant)
  '/supervisor':                 ['master', 'supervisor'],
  '/supervisor/conexao':         ['master', 'supervisor'],
  '/supervisor/equipe':          ['master', 'supervisor'],
  '/supervisor/planos':          ['master', 'supervisor'],
  '/supervisor/templates':       ['master', 'supervisor'],
  '/supervisor/distribuicao':    ['master', 'supervisor'],

  // Workspace — todos os autenticados
  '/workspace':                  ['master', 'supervisor', 'atendente'],

  // Dashboards — supervisor libera via toggle para atendentes
  '/dashboard':                  ['master', 'supervisor', 'atendente'],
  '/crm':                        ['master', 'supervisor', 'atendente'],
  '/transcricoes':               ['master', 'supervisor', 'atendente'],
  '/satisfacao':                 ['master', 'supervisor', 'atendente'],
}

// ── Rotas públicas (sem autenticação) ─────────────────────────
const PUBLIC_PATHS = ['/login', '/cadastro', '/api/auth', '/api/leads', '/api/plans']

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p))
}

function getRequiredRoles(pathname: string): UserRole[] | null {
  for (const [route, roles] of Object.entries(ROLE_MAP)) {
    if (pathname.startsWith(route)) return roles
  }
  return null
}

// ─────────────────────────────────────────────────────────────

export default withAuth(
  function middleware(req: any) {
    const { pathname } = req.nextUrl

    if (isPublic(pathname)) return NextResponse.next()

    const token    = req.nextauth?.token as { role?: UserRole; canViewDashboard?: boolean; canViewCRM?: boolean; canViewTranscricoes?: boolean; canViewSatisfacao?: boolean } | undefined
    const userRole = token?.role

    if (!userRole) {
      const loginUrl = new URL('/login', req.url)
      loginUrl.searchParams.set('callbackUrl', pathname)
      return NextResponse.redirect(loginUrl)
    }

    // Toggle check para atendentes em rotas restritas
    if (userRole === 'atendente') {
      if (pathname.startsWith('/dashboard') && !token?.canViewDashboard) {
        return NextResponse.redirect(new URL('/workspace', req.url))
      }
      if (pathname.startsWith('/crm') && !token?.canViewCRM) {
        return NextResponse.redirect(new URL('/workspace', req.url))
      }
      if (pathname.startsWith('/transcricoes') && !token?.canViewTranscricoes) {
        return NextResponse.redirect(new URL('/workspace', req.url))
      }
      if (pathname.startsWith('/satisfacao') && !token?.canViewSatisfacao) {
        return NextResponse.redirect(new URL('/workspace', req.url))
      }
    }

    const required = getRequiredRoles(pathname)
    if (required && !required.includes(userRole)) {
      // Redireciona para o workspace padrão do role
      const fallback =
        userRole === 'master'      ? '/admin'      :
        userRole === 'supervisor'  ? '/workspace'  : '/workspace'
      return NextResponse.redirect(new URL(fallback, req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      // Só executa o middleware se houver token (já autenticado)
      // ou se a rota for pública
      authorized: ({ token, req }) => {
        if (isPublic(req.nextUrl.pathname)) return true
        return !!token
      },
    },
  }
)

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|fonts|images).*)',
  ],
}
