'use client'
// app/(auth)/recuperar-senha/page.tsx
// Página de solicitação de redefinição de senha.

import { useState } from 'react'
import Link from 'next/link'

type Step = 'form' | 'loading' | 'sent'

export default function RecuperarSenhaPage() {
  const [email,   setEmail]   = useState('')
  const [step,    setStep]    = useState<Step>('form')
  const [error,   setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setStep('loading')

    try {
      await fetch('/api/auth/forgot-password', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email }),
      })
      // Sempre mostra "enviado" — não vaza se e-mail existe
      setStep('sent')
    } catch {
      setError('Erro de conexão. Tente novamente.')
      setStep('form')
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 relative">
      {/* Grid bg */}
      <div className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(163,230,53,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(163,230,53,0.03) 1px,transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

      <div className="relative z-10 w-full max-w-[400px]">
        {/* Brand */}
        <div className="text-center mb-7">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border mb-4"
            style={{ background: 'var(--neon-dim)', borderColor: 'var(--border-neon)' }}>
            <span className="pulse-dot" />
            <span className="text-xs font-semibold tracking-widest uppercase text-neon">AAD</span>
          </div>
          <h1 className="font-display text-[22px] font-bold">Recuperar senha</h1>
          <p className="text-[13px] text-secondary-aad mt-1">
            Informe seu e-mail para receber o link de redefinição
          </p>
        </div>

        <div className="bg-card-aad border border-aad rounded-xl p-7">
          {step === 'sent' ? (
            // ── Confirmação ──────────────────────────────────
            <div className="text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl mx-auto mb-4"
                style={{ background: 'var(--neon-dim)', border: '1px solid var(--border-neon)' }}>
                ✉️
              </div>
              <h2 className="font-display text-[16px] font-bold mb-2">Verifique seu e-mail</h2>
              <p className="text-[13px] text-secondary-aad leading-relaxed mb-5">
                Se <strong className="text-white">{email}</strong> estiver cadastrado,
                você receberá as instruções de redefinição em breve.
              </p>
              <div className="rounded-lg p-3 mb-5 text-[12px] text-muted"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                Não recebeu? Verifique a caixa de spam ou aguarde alguns minutos.
              </div>
              <button
                onClick={() => { setStep('form'); setEmail('') }}
                className="text-[13px] text-neon hover:underline"
              >
                ← Tentar outro e-mail
              </button>
            </div>

          ) : (
            // ── Formulário ───────────────────────────────────
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-secondary-aad mb-1.5">
                  E-mail cadastrado
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                  className="w-full px-3.5 py-2.5 text-sm"
                  autoComplete="email"
                  autoFocus
                />
              </div>

              {error && (
                <p className="text-[13px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={step === 'loading'}
                className="w-full py-2.5 rounded-lg text-[14px] font-semibold flex items-center justify-center gap-2 transition-all"
                style={{ background: 'var(--neon)', color: '#0a0a0a' }}
              >
                {step === 'loading' ? (
                  <><span className="spinner w-4 h-4" /> Enviando...</>
                ) : 'Enviar link de redefinição →'}
              </button>
            </form>
          )}
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
