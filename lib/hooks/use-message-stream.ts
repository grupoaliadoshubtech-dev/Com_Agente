'use client'
// lib/hooks/use-message-stream.ts
// Conexão via Supabase Realtime na tabela _comagente_notify:
//  - type='message' → onNewMessage
//  - outros tipos   → onSystemEvent (alertas de sistema, uso_limite, etc.)
import { useEffect, useState, useRef } from 'react'
import { useRealtimeNotify } from '@/hooks/useRealtimeNotify'

export interface StreamSystemEvent {
  type:    string
  payload: Record<string, unknown> | null
}

export function useMessageStream(
  enabled: boolean,
  onNewMessage:  (phone: string | null) => void,
  onSystemEvent?: (event: StreamSystemEvent) => void
) {
  const [instanceName, setInstanceName] = useState<string>('')
  const msgRef = useRef(onNewMessage)
  const sysRef = useRef(onSystemEvent)
  msgRef.current = onNewMessage
  sysRef.current = onSystemEvent

  useEffect(() => {
    if (!enabled) return
    fetch('/api/evolution/instance')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.instanceName) {
          setInstanceName(d.instanceName)
        }
      })
      .catch(() => {})
  }, [enabled])

  useRealtimeNotify(enabled ? instanceName : '', (notifyRow) => {
    if (!notifyRow) return
    if (notifyRow.type === 'message') {
      msgRef.current(notifyRow.phone ?? null)
    } else {
      sysRef.current?.({
        type: notifyRow.type,
        payload: notifyRow.payload ?? null
      })
    }
  })
}
