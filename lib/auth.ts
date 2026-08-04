// ─────────────────────────────────────────────────────────────
// lib/auth.ts
// Configuração do NextAuth — CredentialsProvider + JWT + RBAC.
// Importado tanto pelo Route Handler quanto pelo middleware.
// ─────────────────────────────────────────────────────────────

import type { NextAuthOptions, DefaultSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { encode as nextAuthEncode, decode as nextAuthDecode } from 'next-auth/jwt'
import bcrypt from 'bcryptjs'
import { UsersRepository } from '@/lib/repositories/users.repository'
import { rateLimit } from '@/lib/rate-limit'
import type { UserRole } from '@/types'

// ── Augmentação de tipos do NextAuth ─────────────────────────
declare module 'next-auth' {
  interface Session {
    user: DefaultSession['user'] & {
      id:                  string
      role:                UserRole
      tenantId:            string
      tenantName:          string
      canViewDashboard:    boolean
      canViewCRM:          boolean
      canViewTranscricoes:  boolean
      canViewSatisfacao:    boolean
      canViewAgendamentos:  boolean
      mustChangePassword:   boolean
    }
  }
  interface User {
    id:                  string
    role:                UserRole
    tenantId:            string
    tenantName:          string
    canViewDashboard:    boolean
    canViewCRM:          boolean
    canViewTranscricoes:  boolean
    canViewSatisfacao:    boolean
    canViewAgendamentos:  boolean
    mustChangePassword:   boolean
    rememberMe:           boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id:                  string
    role:                UserRole
    tenantId:            string
    tenantName:          string
    canViewDashboard:    boolean
    canViewCRM:          boolean
    canViewTranscricoes:  boolean
    canViewSatisfacao:    boolean
    canViewAgendamentos:  boolean
    mustChangePassword:   boolean
    rememberMe:           boolean
  }
}

// ─────────────────────────────────────────────────────────────

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 }, // cookie até 30 dias; JWT exp varia por rememberMe

  // JWT exp: 30 dias se "lembrar", 8h se não
  jwt: {
    encode: async (params) => {
      const rememberMe = (params.token as Record<string, unknown>)?.rememberMe ?? false
      return nextAuthEncode({ ...params, maxAge: rememberMe ? 30 * 24 * 60 * 60 : 8 * 60 * 60 })
    },
    decode: (params) => nextAuthDecode(params),
  },

  pages: {
    signIn:  '/login',
    error:   '/login',
  },

  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'E-mail',              type: 'email' },
        password: { label: 'Senha',               type: 'password' },
        remember: { label: 'Manter-me conectado', type: 'checkbox' },
        demo:     { label: 'Demo',                type: 'text' },
      },

      async authorize(credentials, req) {
        // ── Rate limiting — 10 tentativas por IP a cada 15 min ──
        const ip = (
          (req?.headers?.['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ??
          (req?.headers?.['x-real-ip'] as string | undefined) ??
          'unknown'
        )
        const rl = await rateLimit(`login:${ip}`, 10, 15 * 60)
        if (!rl.allowed) return null

        const repo = new UsersRepository(process.env.GOOGLE_MASTER_SHEET_ID)

        // ── Login demo — credenciais ficam só no servidor ────────
        if (credentials?.demo === 'true') {
          const demoEmail = process.env.DEMO_EMAIL
          const demoPwd   = process.env.DEMO_PASSWORD
          if (!demoEmail || !demoPwd) {
            console.warn('[Auth] DEMO_EMAIL ou DEMO_PASSWORD não configurados.')
            return null
          }
          const demoUser = await repo.findByEmail(demoEmail)
          if (!demoUser || !demoUser.isActive) return null
          const demoMatch = await bcrypt.compare(demoPwd, demoUser.passwordHash)
          if (!demoMatch) return null
          return {
            id:                  demoUser.id,
            email:               demoUser.email,
            name:                demoUser.name,
            role:                demoUser.role,
            tenantId:            demoUser.tenantId,
            tenantName:          '',
            canViewDashboard:    demoUser.canViewDashboard,
            canViewCRM:          demoUser.canViewCRM,
            canViewTranscricoes: demoUser.canViewTranscricoes,
            canViewSatisfacao:    demoUser.canViewSatisfacao,
            canViewAgendamentos:  demoUser.canViewAgendamentos,
            mustChangePassword:   false,
            rememberMe:           false,
          }
        }

        // ── Login normal ─────────────────────────────────────────
        if (!credentials?.email || !credentials?.password) return null

        const user = await repo.findByEmail(credentials.email)
        if (!user || !user.isActive) return null

        const passwordMatch = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        )
        if (!passwordMatch) return null

        return {
          id:                  user.id,
          email:               user.email,
          name:                user.name,
          role:                user.role,
          tenantId:            user.tenantId,
          tenantName:          '', // enriquecido no jwt callback
          canViewDashboard:    user.canViewDashboard,
          canViewCRM:          user.canViewCRM,
          canViewTranscricoes: user.canViewTranscricoes,
          canViewSatisfacao:    user.canViewSatisfacao,
          canViewAgendamentos:  user.canViewAgendamentos,
          mustChangePassword:   user.mustChangePassword ?? false,
          rememberMe:          credentials.remember === 'true',
        }
      },
    }),
  ],

  callbacks: {
    // Persiste campos customizados no token JWT
    async jwt({ token, user, trigger, session: updateData }) {
      if (trigger === 'update' && updateData) {
        if ('mustChangePassword' in updateData) token.mustChangePassword = updateData.mustChangePassword
        if ('name' in updateData) token.name = updateData.name
      }
      if (user) {
        token.id                  = user.id
        token.role                = user.role
        token.tenantId            = user.tenantId
        token.tenantName          = user.tenantName ?? ''
        token.canViewDashboard    = user.canViewDashboard
        token.canViewCRM          = user.canViewCRM
        token.canViewTranscricoes = user.canViewTranscricoes
        token.canViewSatisfacao   = user.canViewSatisfacao
        token.canViewAgendamentos = user.canViewAgendamentos
        token.mustChangePassword  = user.mustChangePassword
        token.rememberMe          = user.rememberMe ?? false
      }
      return token
    },

    // Expõe campos customizados na sessão do cliente
    async session({ session, token }) {
      session.user.id                  = token.id
      session.user.role                = token.role
      session.user.tenantId            = token.tenantId
      session.user.tenantName          = token.tenantName
      session.user.canViewDashboard    = token.canViewDashboard
      session.user.canViewCRM          = token.canViewCRM
      session.user.canViewTranscricoes = token.canViewTranscricoes
      session.user.canViewSatisfacao    = token.canViewSatisfacao
      session.user.canViewAgendamentos  = token.canViewAgendamentos ?? false
      session.user.mustChangePassword   = token.mustChangePassword ?? false
      return session
    },
  },
}
