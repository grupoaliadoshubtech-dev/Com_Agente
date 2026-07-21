// ─────────────────────────────────────────────────────────────
// lib/auth.ts
// Configuração do NextAuth — CredentialsProvider + JWT + RBAC.
// Importado tanto pelo Route Handler quanto pelo middleware.
// ─────────────────────────────────────────────────────────────

import type { NextAuthOptions, DefaultSession } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { UsersRepository } from '@/lib/repositories/users.repository'
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
      canViewTranscricoes: boolean
      canViewSatisfacao:   boolean
      mustChangePassword:  boolean
    }
  }
  interface User {
    id:                  string
    role:                UserRole
    tenantId:            string
    tenantName:          string
    canViewDashboard:    boolean
    canViewCRM:          boolean
    canViewTranscricoes: boolean
    canViewSatisfacao:   boolean
    mustChangePassword:  boolean
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
    canViewTranscricoes: boolean
    canViewSatisfacao:   boolean
    mustChangePassword:  boolean
  }
}

// ─────────────────────────────────────────────────────────────

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 }, // 8 horas

  pages: {
    signIn:  '/login',
    error:   '/login',
  },

  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'E-mail', type: 'email' },
        password: { label: 'Senha',  type: 'password' },
      },

      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        // Master Admin usa a planilha master; outros usam tenant próprio
        const repo = new UsersRepository(process.env.GOOGLE_MASTER_SHEET_ID)
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
          canViewSatisfacao:   user.canViewSatisfacao,
          mustChangePassword:  credentials.password === '098765',
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
        token.mustChangePassword  = user.mustChangePassword
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
      session.user.canViewSatisfacao   = token.canViewSatisfacao
      session.user.mustChangePassword  = token.mustChangePassword ?? false
      return session
    },
  },
}
