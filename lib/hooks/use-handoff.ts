'use client'
// lib/hooks/use-handoff.ts
// Hook para acionar handoff via /api/handoff a partir de componentes client.

import { useState } from 'react'
import type { ApiResponse, HandoffRecord } from '@/types'

type Action = 'pausar' | 'retomar' | 'pausa_global' | 'retornar_global'

interface HandoffResult {
  success: boolean
  data?: HandoffRecord
  error?: string
}

export function useHandoff() {
  const [loading, setLoading] = useState(false)

  async function execute(action: Action, telefone?: string): Promise<HandoffResult> {
    setLoading(true)
    try {
      const res = await fetch('/api/handoff', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action, telefone }),
      })
      const data: ApiResponse<HandoffRecord> = await res.json()
      return { success: data.success, data: data.data, error: data.error }
    } catch {
      return { success: false, error: 'Erro de conexão' }
    } finally {
      setLoading(false)
    }
  }

  return {
    loading,
    pausar:      (telefone: string) => execute('pausar', telefone),
    retomar:     (telefone: string) => execute('retomar', telefone),
    pausaGlobal:    ()                 => execute('pausa_global'),
    retomarGlobal:  ()                 => execute('retornar_global'),
  }
}
