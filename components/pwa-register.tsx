'use client'
// components/pwa-register.tsx
// Registra o Service Worker e solicita permissão de notificação.
// Renderiza um banner "Instalar ComAgente" quando o app é instalável.

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWARegister() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [notifPermission, setNotifPermission] = useState<string>('default')

  useEffect(() => {
    // Registra Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registrado:', reg.scope)
        })
        .catch((err) => {
          console.error('[PWA] Erro ao registrar SW:', err)
        })
    }

    // Captura o evento de instalação
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e as BeforeInstallPromptEvent)
      setShowBanner(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // Checa permissão de notificação
    if ('Notification' in window) {
      setNotifPermission(Notification.permission)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  async function handleInstall() {
    if (!installPrompt) return
    await installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') {
      setShowBanner(false)
      setInstallPrompt(null)
    }
  }

  async function requestNotifications() {
    if (!('Notification' in window)) return
    const permission = await Notification.requestPermission()
    setNotifPermission(permission)
    if (permission === 'granted') {
      // Mostra notificação de teste
      new Notification('ComAgente', {
        body: 'Notificações ativadas! Você será alertado sobre novas mensagens.',
        icon: '/icons/icon-192.png',
      })
    }
  }

  // Não renderiza nada se não há banner nem necessidade de pedir notificação
  if (!showBanner && notifPermission !== 'default') return null

  return (
    <>
      {/* Banner de instalação PWA */}
      {showBanner && (
        <div
          style={{
            position: 'fixed',
            bottom: 16,
            left: 16,
            right: 16,
            zIndex: 9999,
            background: 'var(--bg-card)',
            border: '1px solid rgba(163,230,53,0.3)',
            borderRadius: 14,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
            maxWidth: 440,
            margin: '0 auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'var(--neon)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 14,
                color: '#0a0a0a',
                flexShrink: 0,
              }}
            >
              CA
            </div>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>
                Instalar ComAgente
              </p>
              <p style={{ fontSize: 11, color: 'var(--txt-2)' }}>
                Acesse mais rápido pela tela inicial
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => setShowBanner(false)}
              style={{
                padding: '7px 14px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'transparent',
                color: 'var(--txt-2)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Depois
            </button>
            <button
              onClick={handleInstall}
              style={{
                padding: '7px 14px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--neon)',
                color: '#0a0a0a',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Instalar
            </button>
          </div>
        </div>
      )}

      {/* Solicitação de notificação (aparece discretamente no canto) */}
      {notifPermission === 'default' && !showBanner && (
        <button
          onClick={requestNotifications}
          style={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 9998,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            cursor: 'pointer',
            color: 'var(--txt-2)',
            fontSize: 12,
          }}
        >
          <span style={{ fontSize: 16 }}>🔔</span>
          Ativar notificações
        </button>
      )}
    </>
  )
}
