// ─────────────────────────────────────────────────────────────
// lib/hooks/use-workspace.ts
//
// Hook que combina handoff + envio real via Evolution API.
// Usado pelo workspace/page.tsx para ter envio real de mensagens.
// ─────────────────────────────────────────────────────────────
'use client'

import { useState } from 'react'
import { useHandoff }    from './use-handoff'
import { useEvolution }  from './use-evolution'

export function useWorkspace() {
  const handoff   = useHandoff()
  const evolution = useEvolution()
  const [lastError, setLastError] = useState<string | null>(null)

  /**
   * Envia mensagem real pelo WhatsApp via Evolution API.
   * Após envio, registra no Sheets via API de atendimentos.
   */
  async function sendMessage(to: string, text: string): Promise<boolean> {
    setLastError(null)
    const res = await evolution.sendMessage({ to, text, withTyping: true })
    if (!res.success) {
      setLastError(res.error ?? 'Erro ao enviar')
      return false
    }
    return true
  }

  /** Pausa IA e grava na Fila_Humana. */
  async function pauseIA(telefone: string) {
    return handoff.pausar(telefone)
  }

  /** Retoma IA. */
  async function resumeIA(telefone: string) {
    return handoff.retomar(telefone)
  }

  /** Kill Switch — grava ALL na Fila_Humana. */
  async function killSwitch() {
    return handoff.killSwitch()
  }

  return {
    loading:    evolution.sending || handoff.loading,
    lastError,
    sendMessage,
    pauseIA,
    resumeIA,
    killSwitch,
  }
}
