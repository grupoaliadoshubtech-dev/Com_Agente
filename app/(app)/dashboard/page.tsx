'use client'
// ─────────────────────────────────────────────────────────────
// app/(app)/dashboard/page.tsx
// FASE 7 — Dashboard em tempo real com polling,
// métricas ao vivo, gráficos e exportação de relatórios.
// ─────────────────────────────────────────────────────────────

import { useEffect, useState, useCallback, useRef } from 'react'
import { IcoBot, IcoMoreVertical } from '@/components/icons'
import type { Plan } from '@/types'

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

const VIS_LABELS: Record<string, string> = {
  consumo:   'Consumo de Mensagens',
  realtime:  'Métricas em Tempo Real',
  kpis:      'KPIs Principais',
  kpis2:     'Métricas Secundárias',
  graficos:  'Gráficos de Análise',
  tendencia: 'Tendência e Equipe',
  ranking:   'Ranking por Responsável',
}
type VisKey = keyof typeof VIS_LABELS

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

function UsageCard({ usage, onUpgrade }: { usage: { current: number; limit: number | null; pct: number; anoMes: string }; onUpgrade?: () => void }) {
  const clr = usage.pct >= 100 ? '#EF4444' : usage.pct >= 90 ? '#F59E0B' : usage.pct >= 70 ? '#A3E635' : '#A3E635'
  const clrDim = usage.pct >= 100 ? 'rgba(239,68,68,.12)' : usage.pct >= 90 ? 'rgba(245,158,11,.12)' : 'rgba(163,230,53,.08)'
  const clrBorder = usage.pct >= 100 ? 'rgba(239,68,68,.25)' : usage.pct >= 90 ? 'rgba(245,158,11,.25)' : 'rgba(163,230,53,.18)'

  // Arco SVG estilo medidor de dados — 270° de abertura
  const R = 52, size = 130
  const cx = size / 2, cy = size / 2
  const GAP_DEG = 90  // abertura inferior
  const ARC_DEG = 360 - GAP_DEG
  const startAngle = 90 + GAP_DEG / 2        // começa na parte inferior esquerda
  const filled = (Math.min(usage.pct, 100) / 100) * ARC_DEG

  function polar(angleDeg: number) {
    const rad = (angleDeg - 90) * (Math.PI / 180)
    return { x: cx + R * Math.cos(rad), y: cy + R * Math.sin(rad) }
  }
  function arc(startDeg: number, sweepDeg: number) {
    if (sweepDeg <= 0) return ''
    const s = polar(startDeg), e = polar(startDeg + sweepDeg)
    const large = sweepDeg > 180 ? 1 : 0
    return `M ${s.x} ${s.y} A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y}`
  }

  // Dias restantes no mês
  const now = new Date()
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysLeft = lastDay - now.getDate()

  const statusLabel = usage.pct >= 100 ? 'Limite atingido' : usage.pct >= 90 ? 'Atenção' : usage.pct >= 70 ? 'Moderado' : 'Normal'
  const remaining = usage.limit !== null ? Math.max(0, usage.limit - usage.current) : null

  return (
    <div className="card" style={{ padding: 0, marginBottom: 20, overflow: 'hidden', border: `1px solid ${clrBorder}` }}>
      {/* Cabeçalho */}
      <div style={{ padding: '14px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>Consumo de Mensagens</p>
          <p style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 2 }}>
            Período {usage.anoMes} · renova em {daysLeft} dia{daysLeft !== 1 ? 's' : ''}
          </p>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 100,
          background: clrDim, color: clr, border: `1px solid ${clrBorder}`,
        }}>{statusLabel}</span>
      </div>

      {/* Corpo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '8px 20px 16px', flexWrap: 'wrap' }}>

        {/* Gauge SVG */}
        {usage.limit !== null && (
          <div style={{ position: 'relative', width: size, height: size, flexShrink: 0, margin: '4px auto 0' }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              {/* trilha */}
              <path d={arc(startAngle, ARC_DEG)} fill="none" stroke="var(--bg-input)" strokeWidth={10} strokeLinecap="round" />
              {/* preenchimento */}
              {filled > 0 && (
                <path d={arc(startAngle, filled)} fill="none" stroke={clr} strokeWidth={10} strokeLinecap="round"
                  style={{ filter: `drop-shadow(0 0 6px ${clr}55)`, transition: 'stroke-dasharray 1s ease' }} />
              )}
            </svg>
            {/* centro */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', marginTop: -8 }}>
              <div className="font-display" style={{ fontSize: 26, fontWeight: 800, lineHeight: 1, color: clr }}>{usage.pct}%</div>
              <div style={{ fontSize: 9, color: 'var(--txt-3)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '.06em' }}>utilizado</div>
            </div>
          </div>
        )}

        {/* Detalhes */}
        <div style={{ flex: 1, minWidth: 160, paddingLeft: usage.limit !== null ? 16 : 0, display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center' }}>

          {/* Grid de stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
            <div>
              <div style={{ fontSize: 10, color: 'var(--txt-3)', marginBottom: 2 }}>Utilizadas</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)', fontVariantNumeric: 'tabular-nums' }}>{usage.current.toLocaleString('pt-BR')}</div>
            </div>
            {remaining !== null && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--txt-3)', marginBottom: 2 }}>Restantes</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: remaining === 0 ? 'var(--danger)' : 'var(--neon)', fontVariantNumeric: 'tabular-nums' }}>{remaining.toLocaleString('pt-BR')}</div>
              </div>
            )}
            {usage.limit !== null && (
              <div>
                <div style={{ fontSize: 10, color: 'var(--txt-3)', marginBottom: 2 }}>Limite do plano</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--txt-2)', fontVariantNumeric: 'tabular-nums' }}>{usage.limit.toLocaleString('pt-BR')}/mês</div>
              </div>
            )}
            {usage.limit === null && (
              <div style={{ gridColumn: '1/-1' }}>
                <div style={{ fontSize: 10, color: 'var(--txt-3)', marginBottom: 2 }}>Limite do plano</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--neon)' }}>Ilimitado</div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 10, color: 'var(--txt-3)', marginBottom: 2 }}>Renova em</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--txt-2)' }}>{daysLeft}d</div>
            </div>
          </div>

          {/* Alerta + CTA upgrade */}
          {usage.limit !== null && usage.pct >= 90 && (
            <div>
              <div style={{ fontSize: 11, color: clr, background: clrDim, border: `1px solid ${clrBorder}`, borderRadius: 8, padding: '7px 10px', lineHeight: 1.5, marginBottom: 8 }}>
                {usage.pct >= 100
                  ? '⛔ Limite atingido — mensagens não serão processadas até o próximo período.'
                  : '⚠️ Próximo do limite. Considere fazer upgrade do plano.'}
              </div>
              {onUpgrade && (
                <button onClick={onUpgrade} style={{ width: '100%', padding: '7px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'var(--neon)', color: '#0a0a0a', border: 'none', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>
                  📈 Solicitar Upgrade de Plano
                </button>
              )}
            </div>
          )}
        </div>
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
  const [upgradeOpen,   setUpgradeOpen]   = useState(false)
  const [upgradePlans,  setUpgradePlans]  = useState<Plan[]>([])
  const [upgradePickId, setUpgradePickId] = useState('')
  const [upgradeBusy,   setUpgradeBusy]   = useState(false)
  const [upgradeDone,   setUpgradeDone]   = useState(false)
  const [showVisMenu,   setShowVisMenu]   = useState(false)
  const [vis, setVis] = useState<Record<VisKey, boolean>>({
    consumo: true, realtime: true, kpis: true, kpis2: true,
    graficos: true, tendencia: true, ranking: true,
  })
  const visRef = useRef<HTMLDivElement>(null)

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

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('upgrade') === '1') {
      openUpgrade()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!showVisMenu) return
    function handler(e: MouseEvent) {
      if (visRef.current && !visRef.current.contains(e.target as Node)) setShowVisMenu(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showVisMenu])

  async function openUpgrade() {
    setUpgradeDone(false); setUpgradePickId(''); setUpgradeOpen(true)
    if (upgradePlans.length === 0) {
      const r = await fetch('/api/plans'); const d = await r.json()
      if (d.success) setUpgradePlans(d.data)
    }
  }

  async function submitUpgrade() {
    const plan = upgradePlans.find(p => p.id === upgradePickId)
    if (!plan) return
    setUpgradeBusy(true)
    try {
      await fetch('/api/usage/upgrade-request', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetPlanId: plan.id, targetPlanName: plan.name, targetPlanPrice: plan.price }),
      })
      setUpgradeDone(true)
    } catch { /* silent */ }
    finally { setUpgradeBusy(false) }
  }

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
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--txt)' }}>
              <LiveDot />Dashboard em Tempo Real
            </h1>
            <p style={{ fontSize: 12, color: 'var(--txt-2)', marginTop: 2 }}>
              Atualização automática · último: {updated}
            </p>
          </div>

          {/* Controles — desktop: à direita via space-between | mobile: esquerda ao envolver */}
          <div ref={visRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Exportar relatório — sem emoji */}
            <select
              onChange={e => { if (e.target.value) { const [t, p] = e.target.value.split(':'); exportReport(t, p); e.target.value = '' } }}
              disabled={exporting}
              style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12 }}>
              <option value="">{exporting ? 'Exportando...' : 'Exportar relatório'}</option>
              <option value="atendimentos:7d">Atendimentos (7 dias)</option>
              <option value="atendimentos:30d">Atendimentos (30 dias)</option>
              <option value="atendimentos:all">Atendimentos (tudo)</option>
              <option value="satisfacao:30d">Satisfação (30 dias)</option>
              <option value="satisfacao:all">Satisfação (tudo)</option>
            </select>

            {/* Filtro de visibilidade */}
            <button
              onClick={() => setShowVisMenu(v => !v)}
              className="btn-outline"
              title="Personalizar seções"
              style={{ padding: '7px 10px', fontSize: 13, background: showVisMenu ? 'var(--neon-dim)' : undefined, borderColor: showVisMenu ? 'var(--neon-border)' : undefined, color: showVisMenu ? 'var(--neon)' : undefined }}>
              <IcoMoreVertical size={15}/>
            </button>

            {/* Atualizar — somente ícone, sempre */}
            <button onClick={loadFull} className="btn-outline" style={{ padding: '7px 10px', fontSize: 14 }}>↻</button>

            {/* Dropdown de visibilidade de seções */}
            {showVisMenu && (
              <div style={{
                position: 'absolute', right: 0, top: 'calc(100% + 6px)', zIndex: 200,
                background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
                padding: '6px 0', minWidth: 230, boxShadow: '0 8px 32px rgba(0,0,0,.4)',
              }}>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--txt-3)', padding: '4px 14px 8px' }}>
                  Mostrar seções
                </p>
                {(Object.entries(VIS_LABELS) as [VisKey, string][]).map(([key, label]) => (
                  <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 14px', cursor: 'pointer' }}
                    onClick={() => setVis(v => ({ ...v, [key]: !v[key] }))}>
                    <div style={{
                      width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                      border: `2px solid ${vis[key] ? 'var(--neon)' : 'var(--border)'}`,
                      background: vis[key] ? 'var(--neon)' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {vis[key] && (
                        <svg width={9} height={9} viewBox="0 0 9 9" fill="none">
                          <polyline points="1.5,4.5 3.5,7 7.5,2" stroke="#0a1400" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span style={{ fontSize: 13, color: 'var(--txt)', userSelect: 'none' }}>{label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Card de consumo de mensagens ─────────────────────── */}
        {vis.consumo && usage && <UsageCard usage={usage} onUpgrade={openUpgrade} />}

        {/* ── Métricas em Tempo Real — mesmo layout do UsageCard ── */}
        {vis.realtime && (
          <div className="card" style={{ padding: 0, marginBottom: 20, overflow: 'hidden', border: '1px solid rgba(163,230,53,.18)' }}>
            {/* Cabeçalho */}
            <div style={{ padding: '14px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>Métricas em Tempo Real</p>
                <p style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 2 }}>Última atualização: {updated}</p>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 100, background: 'rgba(163,230,53,.08)', color: 'var(--neon)', border: '1px solid rgba(163,230,53,.18)' }}>
                <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#10B981', animation: 'pulseDot 2s ease-in-out infinite' }}/>
                Ao vivo
              </span>
            </div>
            {/* Grid de métricas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', padding: '4px 0 16px' }}>
              <div style={{ textAlign: 'center', padding: '12px 8px' }}>
                <div style={{ fontSize: 10, color: 'var(--txt-3)', marginBottom: 6 }}>WhatsApp</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: wsColor(rt.whatsappStatus), flexShrink: 0 }} />
                  <span style={{ fontSize: 18, fontWeight: 700, color: wsColor(rt.whatsappStatus), lineHeight: 1 }}>{wsLabel(rt.whatsappStatus)}</span>
                </div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px 8px' }}>
                <div style={{ fontSize: 10, color: 'var(--txt-3)', marginBottom: 6 }}>Atendentes Online</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#10B981' }}>{rt.atendentesOnline}</div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px 8px' }}>
                <div style={{ fontSize: 10, color: 'var(--txt-3)', marginBottom: 6 }}>Conversas Ativas</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#3B82F6' }}>{rt.conversasAtivas}</div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px 8px' }}>
                <div style={{ fontSize: 10, color: 'var(--txt-3)', marginBottom: 6 }}>Fila Humana</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: rt.filaHumana > 0 ? '#EF4444' : 'var(--txt-3)' }}>{rt.filaHumana}</div>
              </div>
              <div style={{ textAlign: 'center', padding: '12px 8px' }}>
                <div style={{ fontSize: 10, color: 'var(--txt-3)', marginBottom: 6 }}>Capacidade</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: rt.capacidadeUsada > 80 ? '#EF4444' : 'var(--neon)' }}>{rt.capacidadeUsada}%</div>
              </div>
            </div>
          </div>
        )}

        {/* ── KPIs principais ─────────────────────────────────── */}
        {vis.kpis && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 10 }}>
          <KPI label="Total de atendimentos" value={m.atendimentos.total} accent large />
          <KPI label="Hoje" value={m.atendimentos.hoje} sub="atendimentos" />
          <KPI label="Semana" value={m.atendimentos.semana} sub="últimos 7 dias" />
          <KPI label="Satisfação média" value={m.satisfacao.media > 0 ? `${m.satisfacao.media}/5` : '—'} sub={`${m.satisfacao.total} avaliações`} accent={m.satisfacao.media >= 4} />
        </div>}

        {vis.kpis2 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, marginBottom: 24 }}>
          <KPI label="Tempo médio" value={`${m.atendimentos.mediaMinutos}min`} sub="por atendimento" />
          <KPI label="Handoff humano" value={`${m.atendimentos.taxaHumano}%`} sub="dos atendimentos" />
          <KPI label="Resolvido pela IA" value={`${100 - m.atendimentos.taxaHumano}%`} sub="automático" color={100 - m.atendimentos.taxaHumano > 70 ? '#10B981' : undefined} />
          <KPI label="Avaliações" value={m.satisfacao.total} sub="respostas" />
        </div>}

        {/* ── Gráficos ────────────────────────────────────────── */}
        {vis.graficos && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>

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
        </div>}

        {vis.tendencia && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>

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
        </div>}

        {/* Ranking atendentes */}
        {vis.ranking && <div className="card" style={{ padding: 20, marginBottom: 16 }}>
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
        </div>}

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--txt-3)', paddingBottom: 8 }}>
          <LiveDot /> Atualizando a cada {REALTIME_POLL / 1000}s · Dados completos a cada {FULL_POLL / 1000}s
        </p>
      </div>

      {/* ── Modal de Upgrade de Plano ───────────────────────────── */}
      {upgradeOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9200, padding: 16 }}>
          <div className="card animate-slide-up" style={{ width: 'min(520px, calc(100vw - 32px))', maxHeight: '90vh', overflowY: 'auto', padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
              <div>
                <div className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--txt)' }}>📈 Solicitar Upgrade de Plano</div>
                <div style={{ fontSize: 11, color: 'var(--txt-3)', marginTop: 2 }}>Selecione o plano desejado. Nossa equipe entrará em contato.</div>
              </div>
              <button onClick={() => setUpgradeOpen(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--txt-2)', lineHeight: 1 }}>×</button>
            </div>

            <div style={{ padding: 20 }}>
              {upgradeDone ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
                  <div className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)', marginBottom: 8 }}>Solicitação enviada!</div>
                  <p style={{ fontSize: 13, color: 'var(--txt-2)', lineHeight: 1.6 }}>Nossa equipe receberá sua solicitação e entrará em contato em breve.<br/>Você também receberá um e-mail de confirmação.</p>
                  <button onClick={() => setUpgradeOpen(false)} className="btn-neon" style={{ marginTop: 20, padding: '10px 32px', fontSize: 13 }}>Fechar</button>
                </div>
              ) : upgradePlans.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '40px 0', color: 'var(--txt-3)' }}>
                  <span className="spinner" style={{ width: 16, height: 16 }} /><span style={{ fontSize: 13 }}>Carregando planos...</span>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                    {upgradePlans.map(p => {
                      const sel = upgradePickId === p.id
                      return (
                        <div key={p.id} onClick={() => setUpgradePickId(p.id)} style={{ cursor: 'pointer', padding: 14, borderRadius: 10, border: `2px solid ${sel ? 'var(--neon)' : 'var(--border)'}`, background: sel ? 'rgba(163,230,53,.06)' : 'var(--bg-input)', transition: 'border-color .15s, background .15s' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 14, height: 14, borderRadius: '50%', border: `2px solid ${sel ? 'var(--neon)' : 'var(--border)'}`, background: sel ? 'var(--neon)' : 'transparent', flexShrink: 0 }} />
                              <span className="font-display" style={{ fontSize: 14, fontWeight: 700, color: 'var(--txt)' }}>{p.name}</span>
                            </div>
                            <span className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--neon)' }}>
                              {p.price > 0 ? `R$ ${(p.price / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mês` : 'Sob consulta'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: 'var(--txt-3)' }}>
                            <span>{p.maxInstances} instância{p.maxInstances !== 1 ? 's' : ''} WA</span>
                            <span>{p.maxAttendants === 999 ? 'Atendentes ilimitados' : `${p.maxAttendants} atendentes`}</span>
                            <span>{p.maxMessages != null ? `${p.maxMessages.toLocaleString('pt-BR')} msgs/mês` : 'Msgs ilimitadas'}</span>
                            {p.price > 0 && <span>Setup: R$ {((p.price / 100) * (p.setupFeePct / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setUpgradeOpen(false)} className="btn-outline" style={{ flex: 1, padding: '10px', fontSize: 13 }}>Cancelar</button>
                    <button onClick={submitUpgrade} disabled={!upgradePickId || upgradeBusy} className="btn-neon" style={{ flex: 2, padding: '10px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: !upgradePickId || upgradeBusy ? .5 : 1 }}>
                      {upgradeBusy ? <><span className="spinner" style={{ width: 14, height: 14 }} />Enviando...</> : 'Confirmar Solicitação'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

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
