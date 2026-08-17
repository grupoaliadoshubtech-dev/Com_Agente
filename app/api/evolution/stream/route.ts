// app/api/evolution/stream/route.ts
// SSE endpoint — faz long-poll na tabela _comagente_notify do Neon.
// Reconecta automaticamente a cada 25 s (dentro do limite do Vercel serverless).
import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { TenantsRepository } from '@/lib/repositories/plans-tenants-leads.repository'
import { getLatestNotifyId, pollNotifications } from '@/lib/evolution/notify'

export const dynamic = 'force-dynamic'

const tenantsRepo = new TenantsRepository()

export async function GET(req: NextRequest): Promise<Response> {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const tenant = await tenantsRepo.findById(session.user.tenantId)
  const instanceName = (tenant as { evolutionInstance?: string } | null)?.evolutionInstance

  if (!instanceName) {
    return new Response('No instance configured', { status: 400 })
  }

  const encoder = new TextEncoder()
  let lastId = await getLatestNotifyId(instanceName)
  let closed = false

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: object) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {}
      }

      send({ type: 'connected' })

      let elapsed = 0
      const RECONNECT_MS = 25_000 // reconecta antes do limite de 30s do Vercel

      let timer: ReturnType<typeof setTimeout>

      const tick = async () => {
        if (closed) return
        try {
          const rows = await pollNotifications(instanceName, lastId)
          if (rows.length > 0) {
            lastId = rows[rows.length - 1].id
            for (const row of rows) {
              send({ type: 'new_message', phone: row.phone })
            }
          }
        } catch {}

        elapsed += 1000
        if (elapsed >= RECONNECT_MS) {
          send({ type: 'reconnect' })
          closed = true
          try { controller.close() } catch {}
          return
        }

        if (!closed) timer = setTimeout(tick, 3000)
      }

      timer = setTimeout(tick, 500) // primeira checagem rápida

      req.signal.addEventListener('abort', () => {
        closed = true
        clearTimeout(timer)
        try { controller.close() } catch {}
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  })
}
