'use client'
// lib/hooks/use-message-stream.ts
// Mantém uma conexão SSE com /api/evolution/stream e chama onNewMessage
// quando chega qualquer notificação de mensagem nova.
import { useEffect, useRef } from 'react'

export function useMessageStream(
  enabled: boolean,
  onNewMessage: (phone: string | null) => void
) {
  const cbRef = useRef(onNewMessage)
  cbRef.current = onNewMessage

  useEffect(() => {
    if (!enabled) return

    let es: EventSource
    let retryTimer: ReturnType<typeof setTimeout>

    function connect() {
      es = new EventSource('/api/evolution/stream')

      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data as string) as { type: string; phone?: string }
          if (data.type === 'new_message') {
            cbRef.current(data.phone ?? null)
          }
          if (data.type === 'reconnect') {
            es.close()
            retryTimer = setTimeout(connect, 100)
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
