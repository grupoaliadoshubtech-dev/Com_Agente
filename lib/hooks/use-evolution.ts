'use client'
// lib/hooks/use-evolution.ts
// Hook client-side para enviar mensagens e consultar status da conexão.

import { useState, useEffect, useCallback } from 'react'

interface SendOptions {
  to:         string
  text:       string
  withTyping?: boolean
}

interface ConnectionStatus {
  connected:   boolean
  state:       'open' | 'close' | 'connecting' | 'unknown'
  profileName?: string
  phone?:       string
}

export function useEvolution() {
  const [sending, setSending] = useState(false)

  async function sendMessage(opts: SendOptions): Promise<{ success: boolean; error?: string }> {
    setSending(true)
    try {
      const res  = await fetch('/api/evolution/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(opts),
      })
      const data = await res.json()
      return { success: data.success, error: data.error }
    } catch {
      return { success: false, error: 'Erro de conexão' }
    } finally {
      setSending(false)
    }
  }

  return { sending, sendMessage }
}

// ── Hook específico para a página de Conexão WhatsApp ─────────

interface QRState {
  loading:     boolean
  connected:   boolean
  state:       string
  qrcode?:     string     // base64
  profileName?: string
  phone?:       string
  error?:       string
}

export function useQRCode(pollIntervalMs = 5000) {
  const [qrState, setQrState] = useState<QRState>({
    loading: true, connected: false, state: 'unknown',
  })

  const fetchQR = useCallback(async () => {
    try {
      const res  = await fetch('/api/evolution/qrcode', { cache: 'no-store' })
      const data = await res.json()

      if (!data.success) {
        setQrState(s => ({ ...s, loading: false, error: data.error }))
        return
      }

      setQrState({
        loading:     false,
        connected:   data.data.connected,
        state:       data.data.state,
        qrcode:      data.data.qrcode,
        profileName: data.data.profileName,
        phone:       data.data.phone,
        error:       undefined,
      })
    } catch (err) {
      setQrState(s => ({ ...s, loading: false, error: String(err) }))
    }
  }, [])

  useEffect(() => {
    fetchQR()
    // Polling para detectar quando conectar
    const interval = setInterval(() => {
      fetchQR()
    }, pollIntervalMs)
    return () => clearInterval(interval)
  }, [fetchQR, pollIntervalMs])

  return { ...qrState, refresh: fetchQR }
}
