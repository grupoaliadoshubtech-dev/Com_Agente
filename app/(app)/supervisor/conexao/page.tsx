'use client'
// app/(app)/supervisor/conexao/page.tsx
// Tela de Conexão WhatsApp — exibe QR Code e status da instância.
// Apenas Supervisor e Master Admin têm acesso.

import { useState } from 'react'
import { useQRCode } from '@/lib/hooks/use-evolution'

export default function ConexaoPage() {
  const qr = useQRCode(4000)  // polling a cada 4s
  const [connecting, setConnecting] = useState(false)

  async function handleConnect() {
    setConnecting(true)
    try {
      await fetch('/api/evolution/qrcode/connect', { method: 'POST' })
      await qr.refresh()
    } finally {
      setConnecting(false)
    }
  }

  return (
    <div className="p-6 max-w-[520px] mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold mb-1">Conexão WhatsApp</h1>
        <p className="text-[14px] text-secondary-aad">
          Escaneie o QR Code com o WhatsApp do número do bot para conectar.
        </p>
      </div>

      {/* Status badge */}
      <div className="flex items-center gap-2 mb-6">
        <div className={`w-2.5 h-2.5 rounded-full ${
          qr.connected       ? 'bg-green-400' :
          qr.state === 'connecting' ? 'bg-yellow-400' :
          'bg-red-400'
        }`} />
        <span className="text-[13px] font-medium">
          {qr.connected  ? `Conectado${qr.profileName ? ` — ${qr.profileName}` : ''}` :
           qr.state === 'connecting' ? 'Conectando...' :
           'Desconectado'}
        </span>
        {qr.phone && (
          <span className="text-[12px] text-muted ml-2">({qr.phone})</span>
        )}
      </div>

      {/* Card principal */}
      <div className="bg-card-aad border border-aad rounded-xl overflow-hidden">
        {qr.loading ? (
          <div className="flex flex-col items-center gap-3 py-16">
            <span className="spinner w-8 h-8" />
            <p className="text-[13px] text-muted">Buscando status da instância...</p>
          </div>

        ) : qr.error ? (
          <div className="flex flex-col items-center gap-3 py-12 px-6 text-center">
            <div className="text-4xl">⚠️</div>
            <p className="text-[14px] font-medium">Erro ao conectar com Evolution API</p>
            <p className="text-[12px] text-muted">{qr.error}</p>
            <button
              onClick={qr.refresh}
              className="mt-2 px-4 py-2 rounded-lg text-[13px] border border-aad text-secondary-aad hover:border-neon hover:text-neon transition-all"
            >
              Tentar novamente
            </button>
          </div>

        ) : qr.connected ? (
          <div className="flex flex-col items-center gap-4 py-12 px-6 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
              style={{ background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.3)' }}>
              ✅
            </div>
            <div>
              <p className="text-[16px] font-semibold text-green-400 mb-1">WhatsApp Conectado</p>
              {qr.profileName && (
                <p className="text-[13px] text-secondary-aad">{qr.profileName}</p>
              )}
              {qr.phone && (
                <p className="text-[12px] text-muted mt-0.5">{qr.phone}</p>
              )}
            </div>
            <p className="text-[12px] text-muted max-w-xs">
              O bot está ativo e recebendo mensagens. Para desconectar, use o botão abaixo.
            </p>
            <button
              onClick={async () => {
                if (!confirm('Desconectar o WhatsApp? O bot deixará de funcionar.')) return
                await fetch('/api/evolution/setup', {
                  method: 'DELETE',
                  headers: { 'Content-Type': 'application/json' },
                })
                qr.refresh()
              }}
              className="px-4 py-2 rounded-lg text-[13px] font-medium text-red-400 border"
              style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)' }}
            >
              Desconectar
            </button>
          </div>

        ) : qr.qrcode ? (
          <div className="flex flex-col items-center gap-4 py-8 px-6">
            {/* QR Code — vem em base64 da Evolution API */}
            <div className="p-3 bg-white rounded-xl">
              <img
                src={`data:image/png;base64,${qr.qrcode}`}
                alt="QR Code WhatsApp"
                width={240}
                height={240}
                className="block"
              />
            </div>
            <div className="text-center">
              <p className="text-[14px] font-medium mb-1">Escaneie com seu WhatsApp</p>
              <p className="text-[12px] text-muted">
                Abra o WhatsApp → Menu → Aparelhos conectados → Conectar aparelho
              </p>
            </div>
            <div className="flex items-center gap-2 text-[12px] text-muted">
              <span className="spinner w-3 h-3" />
              Aguardando conexão... (atualiza automaticamente)
            </div>
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="px-5 py-2.5 rounded-lg text-[13px] font-semibold border border-neon text-neon bg-neon-dim transition-all disabled:opacity-50"
              style={{ minWidth: 180 }}
            >
              {connecting ? (
                <span className="flex items-center gap-2 justify-content-center">
                  <span className="spinner w-3 h-3" /> Gerando QR Code...
                </span>
              ) : '🔄 Gerar novo QR Code'}
            </button>
          </div>

        ) : (
          <div className="flex flex-col items-center gap-4 py-12 px-6 text-center">
            <div className="text-4xl">📱</div>
            <div>
              <p className="text-[14px] font-medium mb-1">WhatsApp desconectado</p>
              <p className="text-[12px] text-muted">
                Clique no botão abaixo para gerar o QR Code e conectar.
              </p>
            </div>
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="mt-1 px-5 py-2.5 rounded-lg text-[13px] font-semibold border border-neon text-neon bg-neon-dim transition-all disabled:opacity-50"
              style={{ minWidth: 180 }}
            >
              {connecting ? (
                <span className="flex items-center gap-2 justify-center">
                  <span className="spinner w-3 h-3" /> Gerando QR Code...
                </span>
              ) : 'Gerar QR Code'}
            </button>
            <button
              onClick={qr.refresh}
              className="text-[12px] text-muted hover:text-neon transition-colors"
            >
              Verificar status
            </button>
          </div>
        )}
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <div className="bg-card-aad border border-aad rounded-xl p-4">
          <p className="text-[11px] text-muted mb-1">Instância</p>
          <p className="text-[13px] font-semibold font-display truncate">
            {process.env.NEXT_PUBLIC_EVOLUTION_INSTANCE ?? '—'}
          </p>
        </div>
        <div className="bg-card-aad border border-aad rounded-xl p-4">
          <p className="text-[11px] text-muted mb-1">Estado</p>
          <p className={`text-[13px] font-semibold font-display capitalize ${
            qr.connected ? 'text-green-400' :
            qr.state === 'connecting' ? 'text-yellow-400' : 'text-red-400'
          }`}>
            {qr.connected ? 'online' : qr.state ?? 'desconhecido'}
          </p>
        </div>
      </div>

      {/* Instruções */}
      <div className="mt-4 bg-card-aad border border-aad rounded-xl p-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-muted mb-3">
          Comandos do atendente (via WhatsApp)
        </p>
        <div className="space-y-2">
          {[
            ['/pausar [número]',     'Pausa a IA para aquele contato'],
            ['/retornar [número]',   'Devolve o contato à IA'],
            ['/finalizar [número]',  'Encerra e dispara pesquisa de satisfação'],
            ['/responder [nº] [txt]','Responde pergunta pendente da IA'],
            ['/status',             'Exibe fila de atendimento humano'],
          ].map(([cmd, desc]) => (
            <div key={cmd} className="flex items-start gap-3">
              <code className="text-[11px] text-neon bg-input-aad px-2 py-0.5 rounded font-mono whitespace-nowrap">
                {cmd}
              </code>
              <span className="text-[12px] text-muted">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
