'use client'
// app/(app)/admin/layout.tsx
// Layout compartilhado para todas as páginas do Master Admin.
// Renderiza guard de role + sub-navegação lateral.

import { useSession } from 'next-auth/react'
import { useRouter, usePathname } from 'next/navigation'
import { useEffect } from 'react'

const ADMIN_NAV = [
  { href: '/admin/empresas',  icon: '🏢', label: 'Empresas',       sub: 'Tenants e provisionamento' },
  { href: '/admin/planos',    icon: '💎', label: 'Planos Master',   sub: 'CRUD de assinaturas' },
  { href: '/admin/blacklist', icon: '🚫', label: 'Blacklist Global',sub: 'Números bloqueados' },
  { href: '/admin/logs',      icon: '⚠️', label: 'Log de Erros',    sub: 'Erros do sistema' },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const router   = useRouter()
  const pathname = usePathname()

  // Guard: apenas master
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

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sub-sidebar Admin */}
      <nav className="w-[220px] border-r flex flex-col flex-shrink-0 overflow-y-auto"
        style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>

        {/* Header */}
        <div className="px-4 py-4 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
              style={{ background: 'rgba(239,68,68,0.1)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)' }}>
              MASTER
            </span>
          </div>
          <p className="font-display text-[14px] font-bold">Painel Administrativo</p>
          <p className="text-[11px] text-muted mt-0.5">Acesso total à infraestrutura</p>
        </div>

        {/* Nav items */}
        <div className="p-2 flex-1">
          {ADMIN_NAV.map(item => {
            const active = pathname.startsWith(item.href)
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 transition-all border ${
                  active
                    ? 'bg-neon-dim border-neon'
                    : 'border-transparent hover:bg-white/[0.04]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[15px]">{item.icon}</span>
                  <span className={`text-[13px] font-medium ${active ? 'text-neon' : 'text-secondary-aad'}`}>
                    {item.label}
                  </span>
                </div>
                <p className="text-[11px] text-muted mt-0.5 ml-6">{item.sub}</p>
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg" style={{ background: 'var(--bg-input)' }}>
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#EF4444' }} />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-red-400 truncate">
                {session.user.email}
              </p>
              <p className="text-[10px] text-muted">Master Admin</p>
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0 overflow-hidden">
        {children}
      </div>
    </div>
  )
}
