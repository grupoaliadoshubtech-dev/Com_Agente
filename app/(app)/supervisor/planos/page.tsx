'use client'
// app/(app)/supervisor/planos/page.tsx
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { Plan } from '@/types'

const PERIOD: Record<string, string> = { monthly: 'Mensal', yearly: 'Anual', custom: 'Customizado' }

export default function PlanosPage() {
  const { data: session } = useSession()
  const [plan,    setPlan]    = useState<Plan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch('/api/plans')
        const d = await r.json()
        if (d.success && d.data?.length > 0) {
          // Busca o plano do tenant atual
          const tenantPlan = d.data[0] as Plan
          setPlan(tenantPlan)
        }
      } catch {
        setError('Erro ao carregar informações do plano')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div style={{ padding: '24px', maxWidth: 560 }}>
      <div className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--txt)', marginBottom: 4 }}>Meu Plano</div>
      <p style={{ fontSize: 13, color: 'var(--txt-2)', marginBottom: 24 }}>Detalhes da assinatura atual da sua empresa.</p>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--txt-2)' }}>
          <span className="spinner" style={{ width: 18, height: 18 }} />
          <span style={{ fontSize: 13 }}>Carregando...</span>
        </div>
      ) : error ? (
        <div style={{ padding: '16px', borderRadius: 12, background: 'var(--danger-dim)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', fontSize: 13 }}>
          {error}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Card plano atual */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div className="font-display" style={{ fontSize: 20, fontWeight: 800, color: 'var(--txt)' }}>{plan?.name ?? 'Plano ativo'}</div>
                <div style={{ fontSize: 12, color: 'var(--txt-2)', marginTop: 2 }}>{PERIOD[plan?.period ?? 'monthly']}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 100, background: 'rgba(16,185,129,.1)', border: '1px solid rgba(16,185,129,.2)', color: '#10B981' }}>
                Ativo
              </span>
            </div>

            {plan?.price != null && (
              <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--neon)', fontFamily: "'Syne',sans-serif" }}>
                  R$ {(plan.price / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
                <span style={{ fontSize: 12, color: 'var(--txt-2)', marginLeft: 6 }}>/{PERIOD[plan.period ?? 'monthly'].toLowerCase()}</span>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: plan?.features?.length ? 16 : 0 }}>
              {plan?.maxInstances != null && (
                <div style={{ padding: '12px', borderRadius: 10, background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--txt-3)', marginBottom: 4 }}>Instâncias</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--txt)' }}>{plan.maxInstances}</div>
                </div>
              )}
              {plan?.maxAttendants != null && (
                <div style={{ padding: '12px', borderRadius: 10, background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--txt-3)', marginBottom: 4 }}>Atendentes</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--txt)' }}>{plan.maxAttendants}</div>
                </div>
              )}
            </div>

            {(plan?.features?.length ?? 0) > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--txt-3)', marginBottom: 10 }}>Recursos inclusos</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {plan.features.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--txt-2)' }}>
                      <span style={{ color: 'var(--neon)', fontSize: 14 }}>✓</span> {f}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Info contato */}
          <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--neon-dim)', border: '1px solid var(--neon-border)', fontSize: 13, color: 'var(--txt-2)' }}>
            Para alterar seu plano ou tirar dúvidas sobre a assinatura, entre em contato com o suporte ComAgente.
          </div>
        </div>
      )}
    </div>
  )
}
