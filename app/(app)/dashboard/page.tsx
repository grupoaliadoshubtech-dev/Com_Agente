'use client'
// ─────────────────────────────────────────────────────────────
// app/(app)/dashboard/page.tsx
// FASE 7 — Dashboard em tempo real com polling,
// métricas ao vivo, gráficos e exportação de relatórios.
// ─────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback } from 'react'
import { IcoBot } from '@/components/icons'

// ── Tipos ────────────────────────────────────────────────────

interface RealtimeData {
  atendentesOnline: number; atendentesOffline: number
  conversasAtivas: number; capacidadeUsada: number
  filaHumana: number; whatsappStatus: string; timestamp: string
}

interface DistAttendant {
  atendenteId: string; atendenteNome: string; online: boolean
  conversasAtivas: number; maxConversas: number; totalAtribuidos: number
}

interface FullMetrics {
  atendimentos: {
    total: number; hoje: number; semana: number
    mediaMinutos: number; taxaHumano: number
    porAtendente: Record<string, number>
  }
  satisfacao: {
    media: number; total: number
    distribuicao: Record<number, number>
    tendencia: Array<{ data: string; media: number }>
  }
  realtime: RealtimeData
  distribuicao: DistAttendant[]
  porHora: Record<string, number>
}

// ── Config ───────────────────────────────────────────────────

const REALTIME_POLL = 10000  // Dados ao vivo a cada 10s
const FULL_POLL     = 60000  // Dados completos a cada 60s

// ── Helpers ──────────────────────────────────────────────────

const EMOJI_NOTA: Record<number, string> = { 1: '😡', 2: '😕', 3: '😐', 4: '🙂', 5: '😀' }
const LABEL_NOTA: Record<number, string> = { 1: 'Péssimo', 2: 'Ruim', 3: 'Regular', 4: 'Bom', 5: 'Ótimo' }

function getNotaColor(n: number) {
  if (n >= 4) return 'var(--neon)'
  if (n === 3) return 'var(--warning)'
  return 'var(--danger)'
}

function wsColor(state: string) {
  if (state === 'open') return '#10B981'
  if (state === 'connecting') return '#F59E0B'
  return '#EF4444'
}

function wsLabel(state: string) {
  if (state === 'open') return 'Conectado'
  if (state === 'connecting') return 'Conectando...'
  if (state === 'close') return 'Desconectado'
  return 'Desconhecido'
}

// ── Componentes ──────────────────────────────────────────────

function LiveDot() {
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#10B981', animation: 'pulseDot 2s ease-in-out infinite', marginRight: 6 }} />
}

function KPI({ label, value, sub, accent, color, large }: {
  label: string; value: string | number; sub?: string; accent?: boolean; color?: string; large?: boolean
}) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: large ? 20 : 16 }}>
      <p style={{ fontSize: 11, color: 'var(--txt-2)', marginBottom: 6 }}>{label}</p>
      <p className="font-display" style={{ fontSize: large ? 34 : 28, fontWeight: 700, color: color ?? (accent ? 'var(--neon)' : 'var(--txt)'), lineHeight: 1, marginBottom: 4 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--txt-3)' }}>{sub}</p>}
    </div>
  )
}

function ScoreRing({ value }: { value: number }) {
  const r = 44, circ = 2 * Math.PI * r, dash = (value / 5) * circ
  const color = value >= 4 ? '#A3E635' : value >= 3 ? '#F59E0B' : '#EF4444'
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={110} height={110} viewBox="0 0 110 110">
        <circle cx={55} cy={55} r={r} fill="none" stroke="var(--border-md)" strokeWidth={8} />
        <circle cx={55} cy={55} r={r} fill="none" stroke={color} strokeWidth={8} strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`} transform="rotate(-90 55 55)" style={{ transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center' }}>
        <div className="font-display" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: 'var(--txt)' }}>{value > 0 ? value.toFixed(1) : '—'}</div>
        <div style={{ fontSize: 10, color: 'var(--txt-3)' }}>/5.0</div>
      </div>
    </div>
  )
}

function HourChart({ data }: { data: Record<string, number> }) {
  const hours = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)
  const values = hours.map(h => data[h] ?? 0)
  const max = Math.max(...values, 1)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 80 }}>
        {values.map((v, i) => (
          <div key={i} title={`${hours[i]} — ${v} atendimentos`}
            style={{
              flex: 1, borderRadius: 2, minHeight: 2,
              background: v > 0 ? 'var(--neon)' : 'rgba(255,255,255,0.04)',
              opacity: v > 0 ? 0.5 + (v / max) * 0.5 : 1,
              height: `${Math.max(2, (v / max) * 100)}%`,
              transition: 'height .5s ease', cursor: 'default',
            }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span style={{ fontSize: 9, color: 'var(--txt-3)' }}>00h</span>
        <span style={{ fontSize: 9, color: 'var(--txt-3)' }}>06h</span>
        <span style={{ fontSize: 9, color: 'var(--txt-3)' }}>12h</span>
        <span style={{ fontSize: 9, color: 'var(--txt-3)' }}>18h</span>
        <span style={{ fontSize: 9, color: 'var(--txt-3)' }}>23h</span>
      </div>
    </div>
  )
}

function TrendBars({ data }: { data: Array<{ data: string; media: number }> }) {
  if (data.length === 0) return <p style={{ fontSize: 12, color: 'var(--txt-3)', padding: '16px 0' }}>Sem dados suficientes</p>
  const max = Math.max(...data.map(d => d.media), 5)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 60, marginBottom: 6 }}>
        {data.map((d, i) => (
          <div key={i} title={`${d.data.slice(5)} · ${d.media}`}
            style={{ flex: 1, borderRadius: 3, minHeight: 4, background: getNotaColor(Math.round(d.media)), opacity: .8, height: `${(d.media / max) * 100}%`, transition: 'height .6s ease', cursor: 'default' }} />
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: 'var(--txt-3)' }}>{data[0]?.data.slice(5)}</span>
        <span style={{ fontSize: 10, color: 'var(--txt-3)' }}>{data.at(-1)?.data.slice(5)}</span>
      </div>
    </div>
  )
}

// ── Componente Principal ─────────────────────────────────────

export default function DashboardPage() {
  const [metrics, setMetrics]     = useState<FullMetrics | null>(null)
  const [realtime, setRealtime]   = useState<RealtimeData | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [updated, setUpdated]     = useState('')
  const [exporting, setExporting] = useState(false)
  const [toast, setToast]         = useState('')
  const [usage, setUsage]         = useState<{ current: number; limit: number | null; pct: number; anoMes: string } | null>(null)

  function showToast(m: string) { setToast(m); setTimeout(() => setToast(''), 3500) }

  // ── Carrega dados completos ────────────────────────────────
  const loadFull = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' })
      const data = await res.json()
      if (!data.success) { setError(data.error); return }
      setMetrics(data.data)
      setRealtime(data.data.realtime)
      setUpdated(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    } catch { setError('Erro ao carregar métricas') }
    finally { setLoading(false) }
  }, [])

  // ── Polling de dados em tempo real (leve) ──────────────────
  const loadRealtime = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard?view=realtime', { cache: 'no-store' })
      const data = await res.json()
      if (data.success && data.data?.realtime) {
        setRealtime(data.data.realtime)
        setUpdated(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      }
    } catch {}
  }, [])

  useEffect(() => {
    loadFull()
    const fullInterval = setInterval(loadFull, FULL_POLL)
    const rtInterval = setInterval(loadRealtime, REALTIME_POLL)
    return () => { clearInterval(fullInterval); clearInterval(rtInterval) }
  }, [loadFull, loadRealtime])

  useEffect(() => {
    fetch('/api/usage').then(r => r.json()).then(d => { if (d.success) setUsage(d.data) }).catch(() => {})
  }, [])

  // ── Exportar relatório ─────────────────────────────────────
  async function exportReport(tipo: string, periodo: string) {
    setExporting(true)
    try {
      const res = await fetch(`/api/dashboard/export?tipo=${tipo}&periodo=${periodo}`)
      if (!res.ok) throw new Error('Erro ao exportar')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `comagente-${tipo}-${periodo}.csv`; a.click()
      URL.revokeObjectURL(url)
      showToast(`✓ Relatório ${tipo} exportado`)
    } catch { showToast('Erro ao exportar') }
    finally { setExporting(false) }
  }

  // ── Render ─────────────────────────────────────────────────

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--txt-2)' }}>
      <span className="spinner" style={{ width: 20, height: 20 }} /><span style={{ fontSize: 13 }}>Carregando dashboard...</span>
    </div>
  )

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 10 }}>
      <p style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p>
      <button onClick={loadFull} className="btn-outline" style={{ padding: '8px 16px', fontSize: 13 }}>Tentar novamente</button>
    </div>
  )

  const m = metrics!
  const rt = realtime ?? m.realtime
  const dist = m.satisfacao.distribuicao
  const tot = Object.values(dist).reduce((a, b) => a + b, 0)
  const atds = Object.entries(m.atendimentos.porAtendente).sort(([, a], [, b]) => b - a).slice(0, 6)

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--txt)' }}>
              <LiveDot />Dashboard em Tempo Real
            </h1>
            <p style={{ fontSize: 12, color: 'var(--txt-2)', marginTop: 2 }}>
              Atualização automática · último: {updated}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* Exportar */}
            <select onChange={e => { if (e.target.value) { const [t, p] = e.target.value.split(':'); exportReport(t, p); e.target.value = '' } }} disabled={exporting}
              style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, width: 180 }}>
              <option value="">{exporting ? 'Exportando...' : '📥 Exportar relatório'}</option>
              <option value="atendimentos:7d">Atendimentos (7 dias)</option>
              <option value="atendimentos:30d">Atendimentos (30 dias)</option>
              <option value="atendimentos:all">Atendimentos (tudo)</option>
              <option value="satisfacao:30d">Satisfação (30 dias)</option>
              <option value="satisfacao:all">Satisfação (tudo)</option>
            </select>
            <button onClick={loadFull} className="btn-outline" style={{ padding: '7px 14px', fontSize: 12 }}>↻</button>
          </div>
        </div>

        {/* ── Faixa em tempo real ──────────────────────────────── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 10, marginBottom: 20, padding: 14, borderRadius: 12,
          background: 'rgba(163,230,53,0.04)', border: '1px solid rgba(163,230,53,0.12)',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--txt-3)', marginBottom: 4 }}>WhatsApp</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: wsColor(rt.whatsappStatus) }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: wsColor(rt.whatsappStatus) }}>{wsLabel(rt.whatsappStatus)}</span>
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--txt-3)', marginBottom: 4 }}>Atendentes Online</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#10B981' }}>{rt.atendentesOnline}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--txt-3)', marginBottom: 4 }}>Conversas Ativas</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#3B82F6' }}>{rt.conversasAtivas}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--txt-3)', marginBottom: 4 }}>Fila Humana</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: rt.filaHumana > 0 ? '#EF4444' : 'var(--txt-3)' }}>{rt.filaHumana}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: 'var(--txt-3)', marginBottom: 4 }}>Capacidade</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: rt.capacidadeUsada > 80 ? '#EF4444' : 'var(--neon)' }}>{rt.capacidadeUsada}%</div>
          </div>
        </div>

        {/* ── KPIs principais ─────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 10 }}>
          <KPI label="Total de atendimentos" value={m.atendimentos.total} accent large />
          <KPI label="Hoje" value={m.atendimentos.hoje} sub="atendimentos" />
          <KPI label="Semana" value={m.atendimentos.semana} sub="últimos 7 dias" />
          <KPI label="Satisfação média" value={m.satisfacao.media > 0 ? `${m.satisfacao.media}/5` : '—'} sub={`${m.satisfacao.total} avaliações`} accent={m.satisfacao.media >= 4} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 24 }}>
          <KPI label="Tempo médio" value={`${m.atendimentos.mediaMinutos}min`} sub="por atendimento" />
          <KPI label="Handoff humano" value={`${m.atendimentos.taxaHumano}%`} sub="dos atendimentos" />
          <KPI label="Resolvido pela IA" value={`${100 - m.atendimentos.taxaHumano}%`} sub="automático" color={100 - m.atendimentos.taxaHumano > 70 ? '#10B981' : undefined} />
          <KPI label="Avaliações" value={m.satisfacao.total} sub="respostas" />
        </div>

        {/* ── Gráficos ────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>

          {/* Atendimentos por hora */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>Atendimentos por hora</p>
              <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>últimas 24h</span>
            </div>
            <HourChart data={m.porHora} />
          </div>

          {/* Distribuição de notas */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>Distribuição de notas</p>
              <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>{tot} respostas</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
              <ScoreRing value={m.satisfacao.media} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)', marginBottom: 2 }}>
                  {m.satisfacao.media >= 4.5 ? 'Excelente' : m.satisfacao.media >= 3.5 ? 'Bom' : m.satisfacao.media >= 2.5 ? 'Regular' : tot === 0 ? 'Sem dados' : 'Atenção'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--txt-3)' }}>{tot} avaliações</p>
              </div>
            </div>
            {tot > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[5, 4, 3, 2, 1].map(n => {
                  const count = dist[n] ?? 0
                  const pct = tot > 0 ? (count / tot) * 100 : 0
                  return (
                    <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 14, width: 18 }}>{EMOJI_NOTA[n]}</span>
                      <span style={{ fontSize: 10, color: 'var(--txt-2)', width: 48 }}>{LABEL_NOTA[n]}</span>
                      <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--bg-input)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 3, background: getNotaColor(n), width: `${pct}%`, transition: 'width .7s ease' }} />
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--txt-3)', width: 22, textAlign: 'right' }}>{count}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>

          {/* Tendência */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>Tendência de satisfação</p>
              <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>últimos 14 dias</span>
            </div>
            <TrendBars data={m.satisfacao.tendencia} />
          </div>

          {/* Equipe online */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>Equipe agora</p>
              <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>{rt.atendentesOnline} online</span>
            </div>
            {m.distribuicao.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--txt-3)' }}>Sem dados de distribuição</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {m.distribuicao.map(a => (
                  <div key={a.atendenteId} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: a.online ? '#10B981' : '#6B7280', flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--txt)', flex: 1 }}>{a.atendenteNome}</span>
                    <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>{a.conversasAtivas}/{a.maxConversas}</span>
                    <div style={{ width: 40, height: 4, borderRadius: 2, background: 'var(--bg-input)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', borderRadius: 2, background: a.online ? '#10B981' : '#6B7280', width: `${a.maxConversas > 0 ? (a.conversasAtivas / a.maxConversas) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Card de uso mensal de mensagens ─────────────────── */}
        {usage && (
          <div className="card" style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>Uso de Mensagens — Plano</p>
                <p style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 2 }}>Período: {usage.anoMes}</p>
              </div>
              {usage.limit !== null && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 100,
                  background: usage.pct >= 100 ? 'rgba(239,68,68,.1)' : usage.pct >= 90 ? 'rgba(245,158,11,.1)' : 'rgba(163,230,53,.08)',
                  color:      usage.pct >= 100 ? 'var(--danger)'      : usage.pct >= 90 ? 'var(--warning)'      : 'var(--neon)',
                  border:     `1px solid ${usage.pct>=100?'rgba(239,68,68,.25)':usage.pct>=90?'rgba(245,158,11,.25)':'rgba(163,230,53,.2)'}`,
                }}>
                  {usage.pct >= 100 ? 'Limite atingido' : usage.pct >= 90 ? 'Atenção' : 'Normal'}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--txt-2)' }}>Mensagens processadas</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt)' }}>
                    {usage.current.toLocaleString('pt-BR')}
                    {usage.limit !== null && <> / {usage.limit.toLocaleString('pt-BR')}</>}
                    {usage.limit === null && <span style={{ color: 'var(--txt-3)', fontWeight: 400 }}> (ilimitado)</span>}
                  </span>
                </div>
                {usage.limit !== null && (
                  <>
                    <div style={{ background: 'var(--bg-input)', borderRadius: 6, height: 10, overflow: 'hidden' }}>
                      <div style={{
                        background: usage.pct >= 100 ? 'var(--danger)' : usage.pct >= 90 ? 'var(--warning)' : 'var(--neon)',
                        width: `${Math.min(usage.pct, 100)}%`, height: '100%', borderRadius: 6, transition: 'width .7s ease',
                      }} />
                    </div>
                    <div style={{ textAlign: 'right', marginTop: 4 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700,
                        color: usage.pct >= 100 ? 'var(--danger)' : usage.pct >= 90 ? 'var(--warning)' : 'var(--txt-3)',
                      }}>{usage.pct}% utilizado</span>
                    </div>
                  </>
                )}
              </div>
              {usage.limit !== null && (
                <div style={{ textAlign: 'center', minWidth: 60 }}>
                  <div className="font-display" style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: usage.pct >= 100 ? 'var(--danger)' : usage.pct >= 90 ? 'var(--warning)' : 'var(--neon)' }}>
                    {usage.pct}%
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--txt-3)', marginTop: 2 }}>do limite</div>
                </div>
              )}
            </div>
            {usage.limit !== null && usage.pct >= 90 && (
              <p style={{ fontSize: 12, color: 'var(--warning)', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)', borderRadius: 8, padding: '8px 12px' }}>
                {usage.pct >= 100
                  ? '⛔ Limite atingido. Novas mensagens não serão processadas pela IA até o próximo período.'
                  : '⚠️ Você está próximo do limite. Considere fazer upgrade do plano para evitar interrupções.'}
              </p>
            )}
          </div>
        )}

        {/* Ranking atendentes */}
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)', marginBottom: 16 }}>Atendimentos por responsável</p>
          {atds.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--txt-3)' }}>Sem dados</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {atds.map(([nome, count], i) => {
                const pct = m.atendimentos.total > 0 ? Math.round((count / m.atendimentos.total) * 100) : 0
                const isBot = nome === 'Bot'
                const barClr = i === 0 ? 'var(--neon)' : isBot ? '#8B5CF6' : '#60A5FA'
                return (
                  <div key={nome} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 10, fontWeight: 700, background: i === 0 ? 'var(--neon-dim)' : 'var(--bg-input)', border: `1px solid ${i === 0 ? 'var(--neon-border)' : 'var(--border)'}`, color: i === 0 ? 'var(--neon)' : 'var(--txt-3)',
                    }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--txt)', display: 'flex', alignItems: 'center', gap: 4 }}>{isBot ? <><IcoBot size={12}/>Bot (IA)</> : nome}</span>
                        <span style={{ fontSize: 11, color: 'var(--txt-2)' }}>{count} · {pct}%</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 2, background: 'var(--bg-input)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 2, background: barClr, width: `${pct}%`, transition: 'width .8s ease' }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--txt-3)', paddingBottom: 8 }}>
          <LiveDot /> Atualizando a cada {REALTIME_POLL / 1000}s · Dados completos a cada {FULL_POLL / 1000}s
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
