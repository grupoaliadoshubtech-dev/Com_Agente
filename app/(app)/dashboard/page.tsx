'use client'
// app/(app)/dashboard/page.tsx — Redesign com dual theme

import { useEffect, useState } from 'react'

interface DashMetrics {
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
}

const EMOJI_NOTA: Record<number, string> = { 1:'😡', 2:'😕', 3:'😐', 4:'🙂', 5:'😀' }
const LABEL_NOTA: Record<number, string> = { 1:'Péssimo', 2:'Ruim', 3:'Regular', 4:'Bom', 5:'Ótimo' }

function getNotaColor(n: number) {
  if (n >= 4) return 'var(--neon)'
  if (n === 3) return 'var(--warning)'
  return 'var(--danger)'
}

function KPI({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="metric-card">
      <p style={{ fontSize: 11, color: 'var(--txt-2)', marginBottom: 6 }}>{label}</p>
      <p className="font-display" style={{ fontSize: 28, fontWeight: 700, color: accent ? 'var(--neon)' : 'var(--txt)', lineHeight: 1, marginBottom: 4 }}>{value}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--txt-3)' }}>{sub}</p>}
    </div>
  )
}

function ScoreRing({ value }: { value: number }) {
  const r    = 44
  const circ = 2 * Math.PI * r
  const dash = (value / 5) * circ
  const color = value >= 4 ? '#A3E635' : value >= 3 ? '#F59E0B' : '#EF4444'

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={110} height={110} viewBox="0 0 110 110">
        <circle cx={55} cy={55} r={r} fill="none" stroke="var(--border-md)" strokeWidth={8} />
        <circle
          cx={55} cy={55} r={r} fill="none"
          stroke={color} strokeWidth={8} strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          transform="rotate(-90 55 55)"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center' }}>
        <div className="font-display" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1, color: 'var(--txt)' }}>
          {value > 0 ? value.toFixed(1) : '—'}
        </div>
        <div style={{ fontSize: 10, color: 'var(--txt-3)' }}>/5.0</div>
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
        {data.map((d, i) => {
          const h = (d.media / max) * 100
          const c = getNotaColor(Math.round(d.media))
          return (
            <div key={i} title={`${d.data.slice(5)} · ${d.media}`}
              style={{ flex: 1, borderRadius: 3, minHeight: 4, background: c, opacity: .8, height: `${h}%`, transition: 'height .6s ease', cursor: 'default' }} />
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: 'var(--txt-3)' }}>{data[0]?.data.slice(5)}</span>
        <span style={{ fontSize: 10, color: 'var(--txt-3)' }}>{data.at(-1)?.data.slice(5)}</span>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [updated, setUpdated] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res  = await fetch('/api/dashboard', { cache: 'no-store' })
      const data = await res.json()
      if (!data.success) { setError(data.error); return }
      setMetrics(data.data)
      setUpdated(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }))
    } catch { setError('Erro ao carregar métricas') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--txt-2)' }}>
      <span className="spinner" style={{ width: 20, height: 20 }} />
      <span style={{ fontSize: 13 }}>Carregando métricas...</span>
    </div>
  )

  if (error) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 10 }}>
      <p style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p>
      <button onClick={load} className="btn-outline" style={{ padding: '8px 16px', fontSize: 13 }}>Tentar novamente</button>
    </div>
  )

  const m    = metrics!
  const dist = m.satisfacao.distribuicao
  const tot  = Object.values(dist).reduce((a,b)=>a+b, 0)
  const atds = Object.entries(m.atendimentos.porAtendente).sort(([,a],[,b])=>b-a).slice(0, 5)

  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ padding: 24, maxWidth: 1100, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="font-display" style={{ fontSize: 20, fontWeight: 700, color: 'var(--txt)' }}>Dashboard</h1>
            <p style={{ fontSize: 12, color: 'var(--txt-2)', marginTop: 2 }}>Visão geral da operação · somente leitura</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {updated && <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>Atualizado às {updated}</span>}
            <button onClick={()=>{setLoading(true);load()}} className="btn-outline" style={{ padding: '7px 14px', fontSize: 12 }}>↻ Atualizar</button>
          </div>
        </div>

        {/* KPIs row 1 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 12 }}>
          <KPI label="Total de atendimentos" value={m.atendimentos.total} accent />
          <KPI label="Hoje"    value={m.atendimentos.hoje}   sub="atendimentos" />
          <KPI label="Semana"  value={m.atendimentos.semana} sub="últimos 7 dias" />
          <KPI label="Satisfação média" value={m.satisfacao.media > 0 ? `${m.satisfacao.media}/5` : '—'} sub={`${m.satisfacao.total} avaliações`} accent={m.satisfacao.media >= 4} />
        </div>

        {/* KPIs row 2 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 24 }}>
          <KPI label="Tempo médio"    value={`${m.atendimentos.mediaMinutos}min`} sub="por atendimento" />
          <KPI label="Handoff humano" value={`${m.atendimentos.taxaHumano}%`}     sub="dos atendimentos" />
          <KPI label="Resolvido pela IA" value={`${100-m.atendimentos.taxaHumano}%`} sub="automático" />
          <KPI label="Avaliações"    value={m.satisfacao.total} sub="respostas" />
        </div>

        {/* Charts row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16, marginBottom: 20 }}>

          {/* Score ring + distribuição */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>Distribuição de notas</p>
              <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>{tot} respostas</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 16 }}>
              <ScoreRing value={m.satisfacao.media} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)', marginBottom: 2 }}>
                  {m.satisfacao.media >= 4.5 ? 'Excelente 🎉' : m.satisfacao.media >= 3.5 ? 'Bom 👍' : m.satisfacao.media >= 2.5 ? 'Regular ⚠️' : tot === 0 ? 'Sem dados' : 'Atenção 🔴'}
                </p>
                <p style={{ fontSize: 11, color: 'var(--txt-3)' }}>{tot} avaliações recebidas</p>
              </div>
            </div>
            {tot === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--txt-3)' }}>Nenhuma avaliação ainda</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[5,4,3,2,1].map(n => {
                  const count = dist[n] ?? 0
                  const pct   = tot > 0 ? (count/tot)*100 : 0
                  return (
                    <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 14, width: 20, textAlign: 'center' }}>{EMOJI_NOTA[n]}</span>
                      <span style={{ fontSize: 11, color: 'var(--txt-2)', width: 52 }}>{LABEL_NOTA[n]}</span>
                      <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--bg-input)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 3, background: getNotaColor(n), width: `${pct}%`, transition: 'width .7s ease' }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--txt-3)', width: 24, textAlign: 'right' }}>{count}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Trend */}
          <div className="card" style={{ padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>Tendência de satisfação</p>
              <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>últimos 14 dias</span>
            </div>
            <TrendBars data={m.satisfacao.tendencia} />
          </div>
        </div>

        {/* Ranking atendentes */}
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)', marginBottom: 16 }}>Atendimentos por responsável</p>
          {atds.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--txt-3)' }}>Sem dados</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {atds.map(([nome, count], i) => {
                const pct    = m.atendimentos.total > 0 ? Math.round((count/m.atendimentos.total)*100) : 0
                const isBot  = nome === 'Bot'
                const barClr = i === 0 ? 'var(--neon)' : isBot ? '#8B5CF6' : '#60A5FA'
                return (
                  <div key={nome} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 700,
                      background: i === 0 ? 'var(--neon-dim)' : 'var(--bg-input)',
                      border: `1px solid ${i === 0 ? 'var(--neon-border)' : 'var(--border)'}`,
                      color: i === 0 ? 'var(--neon)' : 'var(--txt-3)',
                    }}>{i + 1}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {isBot ? '🤖 Bot (Ana Maria)' : nome}
                        </span>
                        <span style={{ fontSize: 12, color: 'var(--txt-2)', flexShrink: 0, marginLeft: 8 }}>{count} · {pct}%</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-input)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 3, background: barClr, width: `${pct}%`, transition: 'width .8s ease' }} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: 'var(--txt-3)', paddingBottom: 8 }}>
          🔒 Painel somente leitura · dados direto do Google Sheets
        </p>
      </div>
    </div>
  )
}
