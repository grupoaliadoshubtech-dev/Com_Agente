// ─────────────────────────────────────────────────────────────
// lib/evolution/tenant-resolver.ts
//
// Resolve qual tenant corresponde a uma instância Evolution API.
// Migrado de Google Sheets (aba Empresas) → Supabase (app.empresas).
//
// Cache em memória simples (TTL 5 min) para não bater no banco
// a cada mensagem recebida.
// ─────────────────────────────────────────────────────────────

import { query } from '@/lib/supabase/client'

const CACHE_TTL = 5 * 60 * 1000  // 5 minutos

export interface TenantInfo {
  tenantId:          string  // UUID de app.empresas.id
  spreadsheetId:     string  // Google Sheets ID do tenant (dados operacionais)
  attendantNumber:   string  // número do atendente principal
  instanceName:      string
}

interface CacheEntry {
  data:      Map<string, TenantInfo>
  expiresAt: number
}

let cache: CacheEntry | null = null

async function loadTenants(): Promise<Map<string, TenantInfo>> {
  if (cache && Date.now() < cache.expiresAt) return cache.data

  const rows = await query<{
    id: string
    evolution_instance: string
    spreadsheet_id: string
    phone: string
  }>(`
    SELECT id, evolution_instance, spreadsheet_id, phone
    FROM app.empresas
    WHERE status != 'inactive'
      AND evolution_instance IS NOT NULL
      AND evolution_instance <> ''
  `)

  const map = new Map<string, TenantInfo>()
  for (const r of rows) {
    const instanceName = String(r.evolution_instance ?? '')
    if (!instanceName) continue
    map.set(instanceName, {
      tenantId:        String(r.id),
      spreadsheetId:   String(r.spreadsheet_id ?? ''),
      attendantNumber: String(r.phone ?? ''),
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
