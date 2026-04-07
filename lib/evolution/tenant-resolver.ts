// ─────────────────────────────────────────────────────────────
// lib/evolution/tenant-resolver.ts
//
// Resolve qual tenant/planilha corresponde a uma instância
// Evolution API. Lê a aba Empresas da planilha Master.
//
// Cache em memória simples (TTL 5 min) para não bater no
// Sheets a cada mensagem recebida.
// ─────────────────────────────────────────────────────────────

import { readRange, rowsToObjects } from '@/lib/sheets/client'

const MASTER_ID = process.env.GOOGLE_MASTER_SHEET_ID!
const CACHE_TTL = 5 * 60 * 1000  // 5 minutos

interface TenantInfo {
  spreadsheetId:     string
  attendantNumber:   string  // número do atendente principal do tenant
  instanceName:      string
}

interface CacheEntry {
  data:      Map<string, TenantInfo>
  expiresAt: number
}

let cache: CacheEntry | null = null

async function loadTenants(): Promise<Map<string, TenantInfo>> {
  if (cache && Date.now() < cache.expiresAt) {
    return cache.data
  }

  const rows    = await readRange(MASTER_ID, 'Empresas!A:H')
  const records = rowsToObjects<Record<string, string>>(rows)

  const map = new Map<string, TenantInfo>()

  for (const r of records) {
    const instanceName = r.evolutionInstance ?? r.EvolutionInstance ?? ''
    if (!instanceName) continue

    map.set(instanceName, {
      spreadsheetId:   r.id,             // ID da planilha do tenant = ID lógico
      attendantNumber: r.phone ?? r.Phone ?? '',
      instanceName,
    })
  }

  cache = { data: map, expiresAt: Date.now() + CACHE_TTL }
  return map
}

/**
 * Dado o nome da instância Evolution, retorna os dados do tenant.
 * Retorna null se a instância não estiver registrada.
 */
export async function resolveTenant(instanceName: string): Promise<TenantInfo | null> {
  const map = await loadTenants()
  return map.get(instanceName) ?? null
}

/** Invalida o cache (chamar após provisionar novo tenant). */
export function invalidateTenantCache(): void {
  cache = null
}
