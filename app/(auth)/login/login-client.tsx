'use client'
// app/(auth)/login/login-client.tsx — Redesign completo com dual theme

import { useState, useEffect } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import type { Plan } from '@/types'

type Tab = 'login' | 'demo'

const PERIOD: Record<string, string> = { monthly: 'mês', yearly: 'ano', custom: 'sob consulta' }

function fmtPrice(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
}

export default function LoginClient() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl  = searchParams.get('callbackUrl') ?? '/workspace'

  const [tab,      setTab]      = useState<Tab>('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const [plans,    setPlans]    = useState<Plan[]>([])

  useEffect(() => {
    fetch('/api/plans')
      .then(r => r.json())
      .then(d => { if (d.success) setPlans((d.data as Plan[]).filter(p => p.isActive !== false)) })
      .catch(() => {})
  }, [])

  // Aplica dark theme por padrão na página de login
  useEffect(() => {
    const saved = localStorage.getItem('aad-theme') ?? 'dark'
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setLoading(true)
    const res = await signIn('credentials', { redirect: false, email, password })
    setLoading(false)
    if (res?.error) { setError('E-mail ou senha inválidos.'); return }
    router.push(callbackUrl)
  }

  async function handleDemo() {
    setLoading(true)
    await signIn('credentials', { redirect: false, email: 'demo@aad.com.br', password: 'demo1234' })
    setLoading(false)
    router.push('/workspace')
  }

  return (
    <main style={{
      minHeight: '100vh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start',
      paddingTop: '10vh',
      padding: '24px',
      background: 'var(--bg)',
      position: 'relative',
      overflowY: 'auto',
    }}>
      {/* Grid background */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(rgba(163,230,53,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(163,230,53,.025) 1px,transparent 1px)',
        backgroundSize: '48px 48px',
      }} />

      {/* Glow orb */}
      <div style={{
        position: 'fixed', top: -120, right: -80,
        width: 400, height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, var(--neon-glow) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420 }}>

{/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {/* Logo mark */}
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'var(--neon)', margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px var(--neon-glow)',
            overflow: 'hidden',
          }}>
            <svg
              width="52"
              height="52"
              viewBox="0 0 512 512"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ display: 'block' }}
            >
              <defs>
                <style>{`@import url('https://fonts.googleapis.com/css2?family=Raleway:wght@900&display=swap');`}</style>
              </defs>
              <g transform="translate(33, 0)">
                <text x="0" y="346" fontFamily="Raleway, Arial Black, sans-serif" fontWeight="900" fontSize="248" fill="#000000">C</text>
                <path d="M 182,346 L 214,346 L 254,167 L 222,167 Z" fill="#FFFFFF"/>
                <path d="M 230,346 L 262,346 L 302,167 L 270,167 Z" fill="#FFFFFF"/>
                <text x="277" y="346" fontFamily="Raleway, Arial Black, sans-serif" fontWeight="900" fontSize="248" fill="#000000">A</text>
              </g>
            </svg>
          </div>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 14px', borderRadius: 100,
            background: 'var(--neon-dim)', border: '1px solid var(--neon-border)',
            marginBottom: 14,
          }}>
            <span className="pulse-dot" />
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--neon)' }}>
              Plataforma Ativa
            </span>
          </div>

          <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--txt)', marginBottom: 6, lineHeight: 1.2 }}>
            Com<span style={{ color: 'var(--neon)' }}>Agente</span>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--txt-2)' }}>
            Agência de Atendimento Digital
          </p>
        </div>

        {/* Card */}
        <div className="card" style={{ padding: 28 }}>

          {/* Tabs */}
          <div style={{
            display: 'flex', background: 'var(--bg-input)',
            borderRadius: 10, padding: 4, marginBottom: 24,
          }}>
            {(['login', 'demo'] as Tab[]).map(t => (
              <button
                key={t}
                onClick={() => { setTab(t); setError('') }}
                style={{
                  flex: 1, padding: '8px 12px', borderRadius: 8,
                  border: 'none', cursor: 'pointer',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: 13, fontWeight: 600,
                  background: tab === t ? 'var(--bg-card)' : 'transparent',
                  color: tab === t ? 'var(--txt)' : 'var(--txt-2)',
                  transition: 'background .15s, color .15s',
                  boxShadow: tab === t ? 'var(--shadow-sm)' : 'none',
                }}
              >
                {t === 'login' ? 'Entrar' : 'Demonstração'}
              </button>
            ))}
          </div>

          {/* Login form */}
          {tab === 'login' && (
            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--txt-2)', marginBottom: 6 }}>
                  E-mail
                </label>
                <input
                  type="email" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com" required
                  style={{ width: '100%', padding: '10px 14px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--txt-2)', marginBottom: 6 }}>
                  Senha
                </label>
                <input
                  type="password" value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  style={{ width: '100%', padding: '10px 14px' }}
                />
                <Link href="/recuperar-senha" style={{
                  display: 'block', textAlign: 'right',
                  fontSize: 12, color: 'var(--txt-3)',
                  marginTop: 6, textDecoration: 'none',
                  transition: 'color .15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--neon)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--txt-3)')}
                >
                  Esqueci minha senha
                </Link>
              </div>

              {error && (
                <div style={{
                  fontSize: 13, color: 'var(--danger)',
                  background: 'var(--danger-dim)',
                  border: '1px solid rgba(239,68,68,.2)',
                  borderRadius: 8, padding: '10px 14px',
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit" disabled={loading}
                className="btn-neon"
                style={{ width: '100%', padding: '12px 20px', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {loading
                  ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Autenticando...</>
                  : 'Entrar na plataforma →'
                }
              </button>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 12, color: 'var(--txt-3)' }}>ou</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              <Link href="/cadastro" style={{
                display: 'block', width: '100%', padding: '11px 20px',
                textAlign: 'center', fontSize: 14, fontWeight: 500,
                textDecoration: 'none',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 10, color: 'var(--txt-2)',
                transition: 'border-color .15s, color .15s, background .15s',
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--neon-border)'; (e.currentTarget as HTMLAnchorElement).style.color = 'var(--neon)'; (e.currentTarget as HTMLAnchorElement).style.background = 'var(--neon-dim)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLAnchorElement).style.color = 'var(--txt-2)'; (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
              >
                Cadastre-se — conheça os planos
              </Link>
            </form>
          )}

          {/* Demo tab */}
          {tab === 'demo' && (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'var(--neon-dim)', border: '1px solid var(--neon-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28, margin: '0 auto 16px',
              }}>
                👁️
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--txt)', marginBottom: 6 }}>
                Acesso Demonstração
              </p>
              <p style={{ fontSize: 13, color: 'var(--txt-2)', marginBottom: 24, lineHeight: 1.5 }}>
                Explore todas as funcionalidades sem necessidade de cadastro.
              </p>
              <button
                onClick={handleDemo} disabled={loading}
                className="btn-neon"
                style={{ width: '100%', padding: '12px 20px', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {loading
                  ? <><span className="spinner" style={{ width: 16, height: 16 }} /> Entrando...</>
                  : 'Entrar como Demonstração →'
                }
              </button>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--txt-3)', marginTop: 20 }}>
          Desenvolvido por <span style={{ color: 'var(--txt-2)', fontWeight: 600 }}>Grupo Aliados Hub Tech</span>
        </p>
      </div>

      {/* Seção de Planos */}
      {plans.length > 0 && (
        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 960, marginTop: 48, paddingBottom: 48 }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--neon)', marginBottom: 8 }}>Planos disponíveis</p>
            <h2 className="font-display" style={{ fontSize: 24, fontWeight: 800, color: 'var(--txt)', marginBottom: 6 }}>Escolha o plano ideal para sua operação</h2>
            <p style={{ fontSize: 14, color: 'var(--txt-2)' }}>Sem fidelidade. Cancele quando quiser.</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {plans.map(p => (
              <div key={p.id} className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 12, position: 'relative' }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--txt-3)', marginBottom: 4 }}>
                    {PERIOD[p.period ?? 'monthly'] === 'sob consulta' ? 'Enterprise' : p.maxAttendants > 5 ? 'Popular' : p.maxInstances === 1 ? 'Básico' : 'Pro'}
                  </p>
                  <p className="font-display" style={{ fontSize: 18, fontWeight: 700, color: 'var(--txt)' }}>{p.name}</p>
                </div>

                <div>
                  {p.price === 0
                    ? <p className="font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--neon)' }}>Sob consulta</p>
                    : <p className="font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--neon)' }}>
                        R$ {fmtPrice(p.price)}<span style={{ fontSize: 13, fontWeight: 400, color: 'var(--txt-3)' }}>/{PERIOD[p.period ?? 'monthly']}</span>
                      </p>
                  }
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-input)', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--txt)' }}>{p.maxInstances ?? 1}</div>
                    <div style={{ fontSize: 10, color: 'var(--txt-3)' }}>Instância{(p.maxInstances ?? 1) > 1 ? 's' : ''}</div>
                  </div>
                  <div style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-input)', border: '1px solid var(--border)', textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--txt)' }}>{p.maxAttendants === 999 ? '∞' : p.maxAttendants ?? 2}</div>
                    <div style={{ fontSize: 10, color: 'var(--txt-3)' }}>Atendentes</div>
                  </div>
                </div>

                {(p.features?.length ?? 0) > 0 && (
                  <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {p.features.slice(0, 4).map((f, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--txt-2)' }}>
                        <span style={{ color: 'var(--neon)', flexShrink: 0 }}>✓</span>{f}
                      </li>
                    ))}
                    {p.features.length > 4 && <li style={{ fontSize: 11, color: 'var(--txt-3)' }}>+{p.features.length - 4} mais...</li>}
                  </ul>
                )}

                <Link href={`/cadastro?planId=${p.id}`}
                  className="btn-neon"
                  style={{ marginTop: 'auto', padding: '10px', fontSize: 13, textAlign: 'center', textDecoration: 'none', borderRadius: 8, display: 'block' }}>
                  Contratar →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
