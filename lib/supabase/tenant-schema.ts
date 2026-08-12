// lib/supabase/tenant-schema.ts
// Helper: resolve o supabaseSchema de um tenant pelo ID.

import { TenantsRepository } from '@/lib/repositories/plans-tenants-leads.repository'

const repo = new TenantsRepository()

export async function getTenantSchema(tenantId: string): Promise<string | null> {
  const tenant = await repo.findById(tenantId)
  return tenant?.supabaseSchema || null
}
