'use client'
// app/(auth)/redefinir-senha/page.tsx
// Página de redefinição de senha — acessada via link do e-mail.
// Valida o token ao montar, exibe form se válido.

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { IcoCheckCircle, IcoClock } from '@/components/icons'

type TokenState = 'checking' | 'valid' | 'invalid' | 'expired'
type FormState  = 'idle' | 'loading' | 'success' | 'error'

export default function RedefinirSenhaPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const token        = searchParams.get('token') ?? ''

  const [tokenState, setTokenState] = useState<TokenState>('checking')
  const [email,      setEmail]      = useState('')
  const [expiresAt,  setExpiresAt]  = useState('')

  const [password,   setPassword]   = useState('')
  const [confirm,    setConfirm]    = useState('')
  const [showPw,     setShowPw]     = useState(false)
  const [formState,  setFormState]  = useState<FormState>('idle')
  const [formError,  setFormError]  = useState('')

  // Verifica token ao montar
  useEffect(() => {
    if (!token) { setTokenState('invalid'); return }

    fetch(`/api/auth/reset-password?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setEmail(data.email)
          setExpiresAt(data.expiresAt)
          setTokenState('valid')
        } else {
          setTokenState(data.expired ? 'expired' : 'invalid')
        }
      })
      .catch(() => setTokenState('invalid'))
  }, [token])

  function validatePassword(): string | null {
    if (password.length < 8) return 'A senha deve ter no mínimo 8 caracteres'
    if (password !== confirm)  return 'As senhas não coincidem'
    if (!/[A-Z]/.test(password)) return 'Inclua ao menos uma letra maiúscula'
    if (!/[0-9]/.test(password)) return 'Inclua ao menos um número'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')

    const validationError = validatePassword()
    if (validationError) { setFormError(validationError); return }

    setFormState('loading')

    try {
      const res  = await fetch('/api/auth/reset-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, password }),
      })
      const data = await res.json()

      if (!data.success) {
        setFormError(data.error ?? 'Erro ao redefinir senha')
        setFormState('error')
        return
      }

      setFormState('success')
      // Redireciona para login após 3s
      setTimeout(() => router.push('/login'), 3000)
    } catch {
      setFormError('Erro de conexão. Tente novamente.')
      setFormState('error')
    }
  }

  // ── Força da senha ──────────────────────────────────────────
  function passwordStrength(): { label: string; pct: number; color: string } {
    if (!password) return { label: '', pct: 0, color: '' }
    let score = 0
    if (password.length >= 8)  score++
    if (password.length >= 12) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++
    if (score <= 1) return { label: 'Fraca',  pct: 20,  color: '#EF4444' }
    if (score <= 2) return { label: 'Regular', pct: 45, color: '#F59E0B' }
    if (score <= 3) return { label: 'Boa',    pct: 70,  color: '#A3E635' }
    return               { label: 'Forte',   pct: 100, color: '#A3E635' }
  }

  const strength     = passwordStrength()
  const timeLeft     = expiresAt
    ? Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000))
    : 0

  // ── Estados do token ────────────────────────────────────────
  if (tokenState === 'checking') return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center">
        <span className="spinner w-8 h-8 block mx-auto mb-3" />
        <p className="text-[13px] text-muted">Verificando link...</p>
      </div>
    </main>
  )

  if (tokenState === 'invalid' || tokenState === 'expired') return (
    <main className="min-h-screen flex items-center justify-center p-6 relative">
      <div className="fixed inset-0 pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(rgba(163,230,53,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(163,230,53,0.03) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="relative z-10 w-full max-w-[400px] text-center">
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
          {tokenState === 'expired' ? '⏱' : '🔗'}
        </div>
        <h1 className="font-display text-[20px] font-bold mb-2">
          {tokenState === 'expired' ? 'Link expirado' : 'Link inválido'}
        </h1>
        <p className="text-[13px] text-secondary-aad mb-6 leading-relaxed">
          {tokenState === 'expired'
            ? 'Este link de redefinição expirou. Links são válidos por 1 hora.'
            : 'Este link é inválido ou já foi utilizado anteriormente.'}
        </p>
        <Link
          href="/recuperar-senha"
          className="inline-block px-5 py-2.5 rounded-lg text-[13px] font-semibold"
          style={{ background: 'var(--neon)', color: '#0a0a0a' }}
        >
          Solicitar novo link →
        </Link>
        <div className="mt-4">
          <Link href="/login" className="text-[13px] text-muted hover:text-neon transition-colors">
            ← Voltar ao login
          </Link>
        </div>
      </div>
    </main>
  )

  // ── Sucesso ─────────────────────────────────────────────────
  if (formState === 'success') return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-[380px] animate-slide-up">
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: 'var(--neon-dim)', border: '1px solid var(--border-neon)', color: 'var(--neon)' }}>
          <IcoCheckCircle size={32}/>
        </div>
        <h1 className="font-display text-[20px] font-bold mb-2">Senha redefinida!</h1>
        <p className="text-[13px] text-secondary-aad mb-2">
          Sua senha foi atualizada com sucesso.
        </p>
        <p className="text-[12px] text-muted mb-6">
          Redirecionando para o login em instantes...
        </p>
        <Link href="/login"
          className="inline-block px-5 py-2.5 rounded-lg text-[13px] font-semibold"
          style={{ background: 'var(--neon)', color: '#0a0a0a' }}>
          Ir para o login →
        </Link>
      </div>
    </main>
  )

  // ── Formulário ───────────────────────────────────────────────
  return (
    <main className="min-h-screen flex items-center justify-center p-6 relative">
      <div className="fixed inset-0 pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(rgba(163,230,53,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(163,230,53,0.03) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />

      <div className="relative z-10 w-full max-w-[400px]">
        {/* Brand */}
        <div className="text-center mb-7">
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: 'var(--neon)', margin: '0 auto 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 24px var(--neon-glow)', overflow: 'hidden',
          }}>
            <svg width="52" height="52" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
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
          {email && (
            <p style={{ fontSize: 13, color: 'var(--txt-2)' }}>
              Nova senha para <strong style={{ color: 'var(--txt)' }}>{email}</strong>
            </p>
          )}
        </div>

        <div className="bg-card-aad border border-aad rounded-xl p-7">
          {/* TTL indicator */}
          {timeLeft > 0 && (
            <div className="flex items-center gap-2 mb-5 px-3 py-2 rounded-lg text-[12px]"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
              <span style={{ color: timeLeft < 15 ? '#EF4444' : 'var(--neon)', display: 'flex' }}><IcoClock size={14}/></span>
              <span className="text-secondary-aad">
                Link expira em{' '}
                <strong style={{ color: timeLeft < 15 ? '#EF4444' : 'var(--neon)' }}>
                  {timeLeft} min
                </strong>
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nova senha */}
            <div>
              <label className="block text-[13px] font-medium text-secondary-aad mb-1.5">
                Nova senha
              </label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Mínimo 8 caracteres"
                  required
                  className="w-full px-3.5 py-2.5 text-sm pr-10"
                  autoComplete="new-password"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setShowPw(s => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted hover:text-white transition-colors"
                >
                  {showPw ? '🙈' : '👁'}
                </button>
              </div>

              {/* Barra de força */}
              {password && (
                <div className="mt-2">
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                    <div className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${strength.pct}%`, background: strength.color }} />
                  </div>
                  <p className="text-[11px] mt-1" style={{ color: strength.color }}>
                    Força: {strength.label}
                  </p>
                </div>
              )}
            </div>

            {/* Confirmar senha */}
            <div>
              <label className="block text-[13px] font-medium text-secondary-aad mb-1.5">
                Confirmar nova senha
              </label>
              <input
                type={showPw ? 'text' : 'password'}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repita a senha"
                required
                className={`w-full px-3.5 py-2.5 text-sm ${
                  confirm && confirm !== password ? 'border-red-500/50' : ''
                }`}
                autoComplete="new-password"
              />
              {confirm && confirm !== password && (
                <p className="text-[11px] text-red-400 mt-1">As senhas não coincidem</p>
              )}
            </div>

            {/* Requisitos */}
            <div className="rounded-lg p-3 text-[11px] space-y-1" style={{ background: 'var(--bg-input)' }}>
              {[
                { ok: password.length >= 8,        label: 'Mínimo 8 caracteres' },
                { ok: /[A-Z]/.test(password),      label: 'Ao menos 1 maiúscula' },
                { ok: /[0-9]/.test(password),      label: 'Ao menos 1 número' },
                { ok: password === confirm && !!confirm, label: 'Senhas coincidem' },
              ].map(({ ok, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <span style={{ color: ok ? 'var(--neon)' : 'var(--text-muted)' }}>
                    {ok ? '✓' : '○'}
                  </span>
                  <span style={{ color: ok ? 'var(--color-text-secondary)' : 'var(--text-muted)' }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>

            {formError && (
              <p className="text-[13px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={formState === 'loading'}
              className="w-full py-2.5 rounded-lg text-[14px] font-semibold flex items-center justify-center gap-2 transition-all"
              style={{ background: 'var(--neon)', color: '#0a0a0a' }}
            >
              {formState === 'loading' ? (
                <><span className="spinner w-4 h-4" /> Redefinindo...</>
              ) : 'Salvar nova senha →'}
            </button>
          </form>
        </div>

        <div className="text-center mt-4">
          <Link href="/login" className="text-[13px] text-muted hover:text-neon transition-colors">
            ← Voltar ao login
          </Link>
        </div>
      </div>
    </main>
  )
}
