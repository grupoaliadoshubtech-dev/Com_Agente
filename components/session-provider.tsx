'use client'
// components/session-provider.tsx
// Wrapper client-side para o SessionProvider do NextAuth.
// Necessário porque o app/layout.tsx é Server Component por padrão.

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
}
