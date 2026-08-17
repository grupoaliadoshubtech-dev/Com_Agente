'use client'
// lib/hooks/use-message-stream.ts
// Mantém uma conexão SSE com /api/evolution/stream e roteia eventos:
//  - type='new_message' → onNewMessage
//  - outros tipos       → onSystemEvent (alertas de sistema, uso_limite, etc.)
import { useEffect, useRef } from 'react'

export interface StreamSystemEvent {
  type:    string
  payload: Record<string, unknown> | null
}

export function useMessageStream(
  enabled: boolean,
  onNewMessage:  (phone: string | null) => void,
  onSystemEvent?: (event: StreamSystemEvent) => void
) {
  const msgRef = useRef(onNewMessage)
  const sysRef = useRef(onSystemEvent)
  msgRef.current = onNewMessage
  sysRef.current = onSystemEvent

  useEffect(() => {
    if (!enabled) return

    let es: EventSource
    let retryTimer: ReturnType<typeof setTimeout>

    function connect() {
      es = new EventSource('/api/evolution/stream')

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data as string) as {
            type: string
            phone?: string
            payload?: Record<string, unknown>
          }

          if (data.type === 'new_message') {
            msgRef.current(data.phone ?? null)
          } else if (data.type === 'reconnect') {
            es.close()
            retryTimer = setTimeout(connect, 100)
          } else if (data.type !== 'connected') {
            sysRef.current?.({ type: data.type, payload: data.payload ?? null })
          }
        } catch {}
      }

      es.onerror = () => {
        es.close()
        retryTimer = setTimeout(connect, 2000)
      }
    }

    connect()
    return () => {
      clearTimeout(retryTimer)
      es?.close()
    }
  }, [enabled])
}
