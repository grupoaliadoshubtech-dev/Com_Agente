'use client'
// app/(app)/admin/layout.tsx
// Guard de role para páginas Master Admin.

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'loading') return
    if (!session || session.user.role !== 'master') {
      router.replace('/workspace')
    }
  }, [session, status, router])

  if (status === 'loading' || session?.user.role !== 'master') {
    return (
      <div className="flex items-center justify-center h-full gap-3 text-muted">
        <span className="spinner w-5 h-5" />
        <span className="text-[13px]">Verificando permissões...</span>
      </div>
    )
  }

  return <>{children}</>
}
