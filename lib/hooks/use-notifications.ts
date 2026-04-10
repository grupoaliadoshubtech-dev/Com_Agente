'use client'
// lib/hooks/use-notifications.ts
// Hook para gerenciar notificações push do navegador.
// Usa a Notification API nativa — sem dependências externas.

import { useState, useEffect, useCallback } from 'react'

interface NotificationOptions {
  title:   string
  body:    string
  icon?:   string
  url?:    string
  tag?:    string
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const [supported, setSupported]   = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setSupported(true)
      setPermission(Notification.permission)
    }
  }, [])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!supported) return false
    const result = await Notification.requestPermission()
    setPermission(result)
    return result === 'granted'
  }, [supported])

  const notify = useCallback((opts: NotificationOptions) => {
    if (!supported || permission !== 'granted') return

    // Não notifica se a página está focada
    if (document.hasFocus()) return

    const notification = new Notification(opts.title, {
      body:    opts.body,
      icon:    opts.icon ?? '/icons/icon-192.png',
      tag:     opts.tag ?? 'comagente',
      silent:  false,
    })

    notification.onclick = () => {
      window.focus()
      if (opts.url) {
        window.location.href = opts.url
      }
      notification.close()
    }

    // Auto-fecha após 8 segundos
    setTimeout(() => notification.close(), 8000)
  }, [supported, permission])

  // Notifica nova mensagem recebida
  const notifyNewMessage = useCallback((contactName: string, preview: string) => {
    notify({
      title: `💬 ${contactName}`,
      body: preview.slice(0, 100),
      url: '/workspace',
      tag: `msg-${contactName}`,
    })
  }, [notify])

  // Notifica handoff (IA pausada)
  const notifyHandoff = useCallback((contactName: string) => {
    notify({
      title: '🔔 Handoff — Atendimento humano',
      body: `${contactName} precisa de atendimento humano`,
      url: '/workspace',
      tag: `handoff-${contactName}`,
    })
  }, [notify])

  return {
    supported,
    permission,
    isGranted: permission === 'granted',
    requestPermission,
    notify,
    notifyNewMessage,
    notifyHandoff,
  }
}
