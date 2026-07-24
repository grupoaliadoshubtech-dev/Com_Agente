// lib/rate-limit.ts
// Rate limiting via Redis (ioredis) com janela fixa.
// Usado em endpoints sensíveis: login, forgot-password, reset-password.

import Redis from 'ioredis'

let _redis: Redis | null = null

function getRedis(): Redis | null {
  if (_redis) return _redis
  const url = process.env.REDIS_URL
  if (!url) return null
  _redis = new Redis(url, { lazyConnect: true, enableReadyCheck: false })
  _redis.on('error', (err) => console.error('[Redis] Erro de conexão:', err.message))
  return _redis
}

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetInSeconds: number
}

/**
 * Verifica e incrementa o contador de tentativas para uma chave.
 * @param key    Identificador único (ex: "login:127.0.0.1")
 * @param limit  Máximo de tentativas permitidas
 * @param windowSec  Janela de tempo em segundos
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowSec: number
): Promise<RateLimitResult> {
  const redis = getRedis()

  // Sem Redis configurado — permite tudo (fail open)
  if (!redis) {
    return { allowed: true, remaining: limit - 1, resetInSeconds: windowSec }
  }

  const redisKey = `comagente:rl:${key}`

  try {
    const current = await redis.incr(redisKey)

    // Na primeira requisição, define o TTL da janela
    if (current === 1) {
      await redis.expire(redisKey, windowSec)
    }

    const ttl = await redis.ttl(redisKey)
    const remaining = Math.max(0, limit - current)

    return {
      allowed:        current <= limit,
      remaining,
      resetInSeconds: ttl > 0 ? ttl : windowSec,
    }
  } catch (err) {
    console.error('[RateLimit] Erro ao consultar Redis:', err)
    // Fail open — não bloqueia por erro de infra
    return { allowed: true, remaining: 0, resetInSeconds: windowSec }
  }
}

/** Extrai o IP real do request (considera proxy reverso) */
export function getClientIp(req: Request): string {
  const forwarded = (req.headers as Headers).get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return 'unknown'
}
