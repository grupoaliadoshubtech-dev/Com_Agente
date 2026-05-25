'use client'
// app/(app)/supervisor/planos/page.tsx
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import type { Plan } from '@/types'

const PERIOD: Record<string, string> = { monthly: 'Mensal', yearly: 'Anual', custom: 'Customizado' }

function fmtPrice(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

export default function PlanosPage() {
  const { data: session } = useSession()
  const [plans,   setPlans]   = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [toast,   setToast]   = useState('')

  const tenantPlanId = (session?.user as Record<string, unknown>)?.planId as string | undefined

  function showToast(m: string) { setToast(m); setTimeout(() => setToast(''), 3500) }

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch('/api/plans')
        const d = await r.json()
        if (d.success) setPlans((d.data as Plan[]).filter(p => p.isActive !== false))
        else setError('Erro ao carregar planos')
      } catch {
        setError('Erro ao carregar planos')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const currentPlan = plans.find(p => p.id === tenantPlanId) ?? plans[0] ?? null
  const otherPlans  = plans.filter(p => p.id !== currentPlan?.id)

  function PlanCard({ plan, isCurrent }: { plan: Plan; isCurrent: boolean }) {
    return (
      <div className="card" style={{
        padding: 20,
        border: isCurrent ? '2px solid var(--neon)' : '1px solid var(--border)',
        position: 'relative',
        transition: 'border-color .2s',
      }}>
        {isCurrent && (
          <span style={{ position: 'absolute', top: -11, left: 16, fontSize: 10, fontWeight: 700, padding: '2px 10px', borderRadius: 100, background: 'var(--neon)', color: '#0a0a0a' }}>
            PLANO ATUAL
          </span>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div className="font-display" style={{ fontSize: 16, fontWeight: 800, color: 'var(--txt)' }}>{plan.name}</div>
            <div style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 2 }}>{PERIOD[plan.period ?? 'monthly']}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 22, fontWeight: 800, color: isCurrent ? 'var(--neon)' : 'var(--txt)', fontFamily: "'Syne',sans-serif" }}>
              R$ {fmtPrice(plan.price)}
            </span>
            <div style={{ fontSize: 10, color: 'var(--txt-3)' }}>/{PERIOD[plan.period ?? 'monthly'].toLowerCase()}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
          <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-input)', border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--txt)' }}>{plan.maxInstances ?? 1}</div>
            <div style={{ fontSize: 10, color: 'var(--txt-3)' }}>Instância{(plan.maxInstances ?? 1) > 1 ? 's' : ''}</div>
          </div>
          <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-input)', border: '1px solid var(--border)', textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--txt)' }}>{plan.maxAttendants ?? 2}</div>
            <div style={{ fontSize: 10, color: 'var(--txt-3)' }}>Atendente{(plan.maxAttendants ?? 2) > 1 ? 's' : ''}</div>
          </div>
        </div>

        {(plan.features?.length ?? 0) > 0 && (
          <div style={{ marginBottom: 16 }}>
            {(plan.features ?? []).map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--txt-2)', marginBottom: 4 }}>
                <span style={{ color: 'var(--neon)', flexShrink: 0 }}>✓</span> {f}
              </div>
            ))}
          </div>
        )}

        {!isCurrent && (
          <button
            onClick={() => showToast(`Para fazer upgrade para o plano ${plan.name}, entre em contato com o suporte ComAgente.`)}
            className="btn-neon"
            style={{ width: '100%', padding: '9px', fontSize: 13, borderRadius: 8 }}
          >
            Solicitar upgrade →
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: 600, display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <div className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--txt)', marginBottom: 4 }}>Planos</div>
        <p style={{ fontSize: 13, color: 'var(--txt-2)' }}>Seu plano atual e opções de upgrade disponíveis.</p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--txt-2)' }}>
          <span className="spinner" style={{ width: 18, height: 18 }} />
          <span style={{ fontSize: 13 }}>Carregando planos...</span>
        </div>
      ) : error ? (
        <div style={{ padding: 16, borderRadius: 12, background: 'var(--danger-dim)', border: '1px solid rgba(239,68,68,.2)', color: 'var(--danger)', fontSize: 13 }}>
          {error}
        </div>
      ) : (
        <>
          {currentPlan && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--txt-3)', marginBottom: 12 }}>Plano atual</div>
              <PlanCard plan={currentPlan} isCurrent />
            </div>
          )}

          {otherPlans.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--txt-3)', marginBottom: 12 }}>Opções de upgrade</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {otherPlans.map(p => <PlanCard key={p.id} plan={p} isCurrent={false} />)}
              </div>
            </div>
          )}

          <div style={{ padding: '14px 16px', borderRadius: 12, background: 'var(--neon-dim)', border: '1px solid var(--neon-border)', fontSize: 13, color: 'var(--txt-2)' }}>
            Para fazer upgrade ou tirar dúvidas sobre sua assinatura, entre em contato com o suporte ComAgente.
          </div>
        </>
      )}

      {toast && <div className="toast-base">{toast}</div>}
    </div>
  )
}
