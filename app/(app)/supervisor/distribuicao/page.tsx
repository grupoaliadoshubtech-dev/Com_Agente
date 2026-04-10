'use client'
// ─────────────────────────────────────────────────────────────
// app/(app)/supervisor/distribuicao/page.tsx
// FASE 6 — Painel de distribuição automática de atendimentos.
// Visualização de atendentes online, capacidade e configuração.
// ─────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'

interface Attendant {
  atendenteId: string; atendenteNome: string; atendentePhone: string
  online: boolean; especialidade: string; maxConversas: number
  conversasAtivas: number; ultimaAtribuicao: string; totalAtribuidos: number
}

interface Metrics {
  totalOnline: number; totalOffline: number; totalConversasAtivas: number
  capacidadeTotal: number; capacidadeUsada: number; atendentes: Attendant[]
}

const ESPECIALIDADES = ['geral', 'vendas', 'suporte', 'financeiro', 'tecnico']

export default function DistribuicaoPage() {
  const [metrics, setMetrics]     = useState<Metrics | null>(null)
  const [loading, setLoading]     = useState(true)
  const [toast, setToast]         = useState('')
  const [editId, setEditId]       = useState<string | null>(null)
  const [editEsp, setEditEsp]     = useState('')
  const [editMax, setEditMax]     = useState(5)

  function showToast(m: string) { setToast(m); setTimeout(() => setToast(''), 3500) }

  async function load() {
    try {
      const r = await fetch('/api/distribution?view=metrics', { cache: 'no-store' })
      const d = await r.json()
      if (d.success) setMetrics(d.data)
    } catch {} finally { setLoading(false) }
  }
  useEffect(() => { load(); const i = setInterval(load, 10000); return () => clearInterval(i) }, [])

  async function toggleOnline(id: string, online: boolean) {
    try {
      const r = await fetch('/api/distribution', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ atendenteId: id, action: 'toggle_online', online }),
      })
      const d = await r.json()
      showToast(d.success ? (online ? '🟢 Online' : '⚫ Offline') : 'Erro: ' + d.error)
      load()
    } catch { showToast('Erro de conexão') }
  }

  async function saveConfig(id: string) {
    try {
      const r = await fetch('/api/distribution', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ atendenteId: id, action: 'update_config', especialidade: editEsp, maxConversas: editMax }),
      })
      const d = await r.json()
      showToast(d.success ? '✓ Configuração salva' : 'Erro: ' + d.error)
      setEditId(null); load()
    } catch { showToast('Erro ao salvar') }
  }

  async function syncUsers() {
    try {
      const r = await fetch('/api/distribution', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const d = await r.json()
      showToast(d.success ? '✓ ' + d.message : 'Erro: ' + d.error)
      load()
    } catch { showToast('Erro ao sincronizar') }
  }

  async function liberarConversa(id: string) {
    try {
      const r = await fetch('/api/distribution', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ atendenteId: id, action: 'liberar' }),
      })
      const d = await r.json()
      showToast(d.success ? '✓ Conversa liberada' : 'Erro: ' + d.error)
      load()
    } catch { showToast('Erro') }
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: 'var(--txt-2)' }}><span className="spinner" style={{ width: 18, height: 18 }} /><span style={{ fontSize: 13 }}>Carregando distribuição...</span></div>

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--txt)', margin: 0 }}>Distribuição de Atendimentos</h1>
          <p style={{ fontSize: 12, color: 'var(--txt-2)', marginTop: 4 }}>Round-robin automático com regras de especialidade e capacidade</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={syncUsers} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--txt-2)' }}>↻ Sincronizar Equipe</button>
          <button onClick={load} style={{ padding: '8px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--txt-2)' }}>↻</button>
        </div>
      </div>

      {/* Métricas */}
      {metrics && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Online', value: metrics.totalOnline, color: '#10B981', icon: '🟢' },
            { label: 'Offline', value: metrics.totalOffline, color: '#6B7280', icon: '⚫' },
            { label: 'Conversas Ativas', value: metrics.totalConversasAtivas, color: '#3B82F6', icon: '💬' },
            { label: 'Capacidade', value: `${metrics.capacidadeUsada}%`, color: metrics.capacidadeUsada > 80 ? '#EF4444' : '#A3E635', icon: '📊' },
          ].map(m => (
            <div key={m.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{m.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: m.color }}>{m.value}</div>
              <div style={{ fontSize: 11, color: 'var(--txt-2)', marginTop: 2 }}>{m.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Lista de atendentes */}
      {!metrics || metrics.atendentes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--txt-3)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
          <p style={{ fontSize: 14 }}>Nenhum atendente configurado</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Clique em "Sincronizar Equipe" para importar da aba Usuarios</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {metrics.atendentes.map(a => {
            const isEditing = editId === a.atendenteId
            const usage = a.maxConversas > 0 ? Math.round((a.conversasAtivas / a.maxConversas) * 100) : 0

            return (
              <div key={a.atendenteId} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
                padding: 16, display: 'flex', alignItems: 'center', gap: 16,
                borderLeft: `4px solid ${a.online ? '#10B981' : '#4B5563'}`,
              }}>
                {/* Avatar + Status */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14, fontWeight: 700, color: '#fff',
                    background: a.online ? '#10B981' : '#4B5563',
                  }}>
                    {a.atendenteNome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
                  </div>
                  <div style={{
                    position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: '50%',
                    background: a.online ? '#10B981' : '#6B7280', border: '2px solid var(--bg-card)',
                  }} />
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--txt)' }}>{a.atendenteNome}</span>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 100, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--txt-2)' }}>{a.especialidade}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 2, fontFamily: 'monospace' }}>{a.atendentePhone || 'Sem telefone'}</div>

                  {/* Barra de capacidade */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
                    <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', maxWidth: 150 }}>
                      <div style={{
                        width: `${usage}%`, height: '100%', borderRadius: 3,
                        background: usage > 80 ? '#EF4444' : usage > 50 ? '#F59E0B' : '#10B981',
                        transition: 'width .3s',
                      }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--txt-2)', whiteSpace: 'nowrap' }}>
                      {a.conversasAtivas}/{a.maxConversas} conversas
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--txt-3)' }}>
                      ({a.totalAtribuidos} total)
                    </span>
                  </div>
                </div>

                {/* Ações */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                  {isEditing ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <select value={editEsp} onChange={e => setEditEsp(e.target.value)} style={{ padding: '5px 8px', borderRadius: 6, fontSize: 11, width: 100 }}>
                        {ESPECIALIDADES.map(e => <option key={e} value={e}>{e}</option>)}
                      </select>
                      <input type="number" value={editMax} onChange={e => setEditMax(Number(e.target.value))} min={1} max={20} style={{ padding: '5px 8px', borderRadius: 6, fontSize: 11, width: 50, textAlign: 'center' }} />
                      <button onClick={() => saveConfig(a.atendenteId)} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: 'var(--neon)', border: 'none', color: '#0a0a0a', fontWeight: 600 }}>Salvar</button>
                      <button onClick={() => setEditId(null)} style={{ padding: '5px 8px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--txt-2)' }}>×</button>
                    </div>
                  ) : (
                    <>
                      {a.conversasAtivas > 0 && (
                        <button onClick={() => liberarConversa(a.atendenteId)} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#3B82F6' }} title="Liberar 1 conversa">-1</button>
                      )}
                      <button onClick={() => { setEditId(a.atendenteId); setEditEsp(a.especialidade); setEditMax(a.maxConversas) }} style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--txt-2)' }}>Config</button>
                      <button onClick={() => toggleOnline(a.atendenteId, !a.online)} style={{
                        padding: '5px 14px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        background: a.online ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
                        border: `1px solid ${a.online ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
                        color: a.online ? '#EF4444' : '#10B981',
                      }}>
                        {a.online ? 'Ficar Offline' : 'Ficar Online'}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Info */}
      <div style={{ marginTop: 24, padding: 16, borderRadius: 12, background: 'rgba(163,230,53,0.05)', border: '1px solid rgba(163,230,53,0.15)' }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--neon)', marginBottom: 6 }}>Como funciona a distribuição</p>
        <p style={{ fontSize: 12, color: 'var(--txt-2)', lineHeight: 1.6 }}>
          Quando a IA pausa e um atendimento precisa de humano, o sistema seleciona automaticamente o próximo atendente disponível.
          A prioridade é: quem tem menos conversas ativas, depois quem foi atribuído há mais tempo.
          Se há atendentes especializados e o cliente precisa de suporte específico, o especialista tem prioridade.
          Se nenhum atendente está online, o supervisor é notificado como fallback.
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full text-[13px] font-medium z-[200]"
          style={{ background: 'var(--bg-card)', border: '1px solid rgba(163,230,53,0.3)', color: 'var(--neon)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
