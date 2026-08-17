'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

// ─── tipos ───────────────────────────────────────────────────
interface SupabaseData {
  connections: { active: number; idle: number; waiting: number; total: number }
  dbSizeBytes: number
  tables: { name: string; totalBytes: number; liveRows: number }[]
  instances: { name: string; connectionStatus: string }[]
}
interface R2Data        { objectCount: number; storageBytes: number }
interface MessageData   { perMinute: number; perHour: number; uploadErrors: number }
interface MonitorData   { supabase: SupabaseData | null; r2: R2Data | null; messages: MessageData | null }

// ─── helpers ─────────────────────────────────────────────────
function fmtBytes(b: number, decimals = 1) {
  if (b === 0) return '0 B'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(b) / Math.log(k))
  return parseFloat((b / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}
function fmtNum(n: number) {
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n)
}
function pct(used: number, total: number) {
  return Math.min(100, Math.round((used / total) * 100))
}
const SB_LIMIT  = 500 * 1024 * 1024  // 500 MB
const R2_LIMIT  = 10  * 1024 * 1024 * 1024  // 10 GB
const CONN_LIMIT = 100

// ─── sub-components ──────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-display" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.12em', color: 'var(--neon)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
      {children}
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg,var(--neon-border),transparent)' }} />
    </div>
  )
}

function AlertBanner({ pct: p, msgs }: { pct: number; msgs: string }) {
  const cls = p >= 90 ? 'danger' : p >= 70 ? 'warn' : 'ok'
  const clr = cls === 'danger' ? '#ef4444' : cls === 'warn' ? '#f59e0b' : '#10b981'
  const bg  = cls === 'danger' ? 'rgba(239,68,68,.08)' : cls === 'warn' ? 'rgba(245,158,11,.08)' : 'rgba(16,185,129,.08)'
  const bd  = cls === 'danger' ? 'rgba(239,68,68,.25)' : cls === 'warn' ? 'rgba(245,158,11,.25)' : 'rgba(16,185,129,.2)'
  return (
    <div style={{ marginTop: 14, padding: '9px 12px', borderRadius: 10, background: bg, border: `1px solid ${bd}`, color: clr, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 }}>
      {cls === 'ok'
        ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
        : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
      {msgs}
    </div>
  )
}

function Ring({ p, color, label, sub }: { p: number; color: string; label: string; sub: string }) {
  const circum = 201.06
  const offset = circum - (p / 100) * circum
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <svg width="80" height="80" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r="32" fill="none" stroke="var(--border)" strokeWidth="7"/>
        <circle cx="40" cy="40" r="32" fill="none" stroke={color} strokeWidth="7"
          strokeLinecap="round" strokeDasharray={circum} strokeDashoffset={offset}
          transform="rotate(-90 40 40)" style={{ transition: 'stroke-dashoffset .6s ease' }}/>
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1.2 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color }}>{label}</span>
        <span style={{ fontSize: 9, fontWeight: 500, color: 'var(--txt-3)', marginTop: 2 }}>{sub}</span>
      </div>
    </div>
  )
}

function BarTrack({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ height: 5, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ height: '100%', borderRadius: 99, width: `${Math.min(value, 100)}%`, background: color, transition: 'width .6s ease' }}/>
    </div>
  )
}

// Popover de ajuda nos cards de métrica
function Popover({ id, title, children, open, onToggle }: { id: string; title: string; children: React.ReactNode; open: boolean; onToggle: (id: string, e: React.MouseEvent) => void }) {
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={e => onToggle(id, e)}
        style={{ width: 24, height: 24, borderRadius: 6, background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--txt-3)', fontSize: 16, marginTop: -3, marginRight: -4, transition: 'background .15s, color .15s' }}
        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-hover)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--txt-2)' }}
        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--txt-3)' }}
      >⋮</button>
      {open && (
        <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 28, right: 0, zIndex: 50, width: 230, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 11, padding: '13px 14px', boxShadow: '0 8px 32px rgba(0,0,0,.45)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--txt)', marginBottom: 7 }}>{title}</div>
          <div style={{ fontSize: 11, color: 'var(--txt-2)', lineHeight: 1.65 }}>{children}</div>
        </div>
      )}
    </div>
  )
}

// Card de métrica com valor / máximo, barra e tooltip
function MetricCard({ stripe, border, label, value, unit, maxLabel, barPct, barColor, sub, popTitle, popId, openPop, onTogglePop, children }: {
  stripe: string; border: string; label: string; value: string; unit: string; maxLabel: string;
  barPct: number; barColor: string; sub: string; popTitle: string; popId: string;
  openPop: string | null; onTogglePop: (id: string, e: React.MouseEvent) => void; children: React.ReactNode
}) {
  return (
    <div style={{ background: 'var(--bg-card)', border: `1px solid var(--border)`, borderRadius: 14, padding: '0 16px 14px', position: 'relative', transition: 'border-color .18s' }}
      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = border}
      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'}
    >
      {/* stripe topo */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: stripe, borderRadius: '14px 14px 0 0' }}/>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: 16, marginBottom: 10 }}>
        <div className="font-display" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '.09em', color: 'var(--txt-3)', lineHeight: 1.4 }} dangerouslySetInnerHTML={{ __html: label }}/>
        <Popover id={popId} title={popTitle} open={openPop === popId} onToggle={onTogglePop}>{children}</Popover>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginBottom: 3 }}>
        <span className="font-display" style={{ fontSize: 34, fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em', color: barColor }}>{value}</span>
        <span style={{ fontSize: 13, color: 'var(--txt-3)', fontWeight: 500 }}>{unit}</span>
        {maxLabel && <span style={{ fontSize: 12, color: 'var(--txt-3)' }}>{maxLabel}</span>}
      </div>
      <div style={{ fontSize: 11, color: 'var(--txt-3)', marginBottom: 12 }}>{sub}</div>
      <BarTrack value={barPct} color={barColor}/>
    </div>
  )
}

// ─── page ────────────────────────────────────────────────────
export default function MonitoramentoPage() {
  const [data,        setData]       = useState<MonitorData | null>(null)
  const [apiErrors,   setApiErrors]  = useState<Record<string, string | null>>({})
  const [loading,     setLoading]    = useState(true)
  const [refreshing,  setRefreshing] = useState(false)
  const [updatedAt,   setUpdatedAt]  = useState('')
  const [autoOn,      setAutoOn]     = useState(true)
  const [openPop,     setOpenPop]    = useState<string | null>(null)
  const autoRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true)
    try {
      const r = await fetch('/api/admin/monitoring', { cache: 'no-store' })
      const j = await r.json()
      if (j.success) {
        setData(j.data)
        setApiErrors(j.errors ?? {})
        setUpdatedAt(new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
      }
    } catch { /* silencia */ }
    finally {
      setLoading(false)
      if (manual) setTimeout(() => setRefreshing(false), 600)
    }
  }, [])

  useEffect(() => { load(false) }, [load])

  useEffect(() => {
    if (autoOn) { autoRef.current = setInterval(load, 30_000) }
    else { if (autoRef.current) clearInterval(autoRef.current) }
    return () => { if (autoRef.current) clearInterval(autoRef.current) }
  }, [autoOn, load])

  function togglePop(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    setOpenPop(prev => prev === id ? null : id)
  }

  const sb  = data?.supabase
  const r2  = data?.r2
  const msg = data?.messages

  // ── storage calcs ──
  const sbPct = sb ? pct(sb.dbSizeBytes, SB_LIMIT) : 0
  const r2Pct = r2 ? pct(r2.storageBytes, R2_LIMIT) : 0
  const sbUsedMB = sb ? (sb.dbSizeBytes / (1024 * 1024)).toFixed(0) : '—'
  const sbLeftMB = sb ? Math.round((SB_LIMIT - sb.dbSizeBytes) / (1024 * 1024)) : 0
  const r2UsedGB = r2 ? (r2.storageBytes / (1024 * 1024 * 1024)).toFixed(2) : '—'
  const r2LeftGB = r2 ? ((R2_LIMIT - r2.storageBytes) / (1024 * 1024 * 1024)).toFixed(1) : 0

  // ── connection color ──
  const connVal   = sb?.connections.total ?? 0
  const connColor = connVal < 30 ? 'var(--neon)' : connVal < 80 ? '#f59e0b' : '#ef4444'
  const connPct   = pct(connVal, CONN_LIMIT)

  // ── upload error color ──
  const errVal   = msg?.uploadErrors ?? 0
  const errColor = errVal === 0 ? 'var(--neon)' : errVal < 5 ? '#f59e0b' : '#ef4444'

  // ── msg/min color ──
  const mpmVal   = msg?.perMinute ?? 0
  const mpmColor = mpmVal > 40 ? '#f59e0b' : 'var(--neon)'

  // ── Message table info ──
  const msgTable  = sb?.tables.find(t => t.name === 'Message')
  const msgRows   = msgTable ? fmtNum(msgTable.liveRows) : '—'
  const msgBytes  = msgTable ? fmtBytes(msgTable.totalBytes) : '—'
  const msgPctSB  = msgTable && sb ? pct(msgTable.totalBytes, sb.dbSizeBytes) : 0

  // ── instances ──
  const connectedInst   = sb?.instances.filter(i => i.connectionStatus === 'open').length ?? 0
  const totalInst       = sb?.instances.length ?? 0

  const th = { padding: '9px 18px', fontSize: 10, fontWeight: 700 as const, textTransform: 'uppercase' as const, letterSpacing: '.07em', color: 'var(--txt-3)', textAlign: 'left' as const, borderBottom: '1px solid var(--border)' }
  const td = { padding: '13px 18px', fontSize: 13, color: 'var(--txt-2)', verticalAlign: 'middle' as const, borderBottom: '1px solid var(--border)' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }} onClick={() => setOpenPop(null)}>

      {/* ── toolbar ── */}
      <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: 'var(--bg-card)', flexWrap: 'wrap' }}>
        {/* lado esquerdo: subtitle + chips de seção */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ fontSize: 11, color: 'var(--txt-3)', whiteSpace: 'nowrap' }}>Infraestrutura em tempo real</span>
          <span style={{ fontSize: 10, color: 'var(--border)' }}>—</span>
          {(['Supabase & R2', 'Métricas', 'Instâncias WhatsApp'] as const).map(s => (
            <span key={s} style={{ fontSize: 10, fontWeight: 600, color: 'var(--txt-3)', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 99, padding: '2px 8px', whiteSpace: 'nowrap' }}>{s}</span>
          ))}
        </div>
        {/* lado direito: controles */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, color: 'var(--neon)', letterSpacing: '.06em', textTransform: 'uppercase' as const }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--neon)', animation: 'blink 1.2s ease-in-out infinite' }}/>
            Ao vivo
          </div>
          {updatedAt && <span className="mon-ts" style={{ fontSize: 10, color: 'var(--txt-3)', fontFamily: 'monospace' }}>{updatedAt}</span>}
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--txt-2)', cursor: 'pointer', userSelect: 'none' as const }}>
            <div onClick={() => setAutoOn(a => !a)} style={{ width: 30, height: 17, background: autoOn ? 'var(--neon)' : 'var(--bg-input)', border: `1px solid ${autoOn ? 'var(--neon)' : 'var(--border)'}`, borderRadius: 99, position: 'relative', flexShrink: 0, transition: 'background .2s,border-color .2s', cursor: 'pointer' }}>
              <div style={{ position: 'absolute', width: 11, height: 11, borderRadius: '50%', background: '#fff', top: 2, left: 2, transition: 'transform .2s', transform: autoOn ? 'translateX(13px)' : 'none', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }}/>
            </div>
            <span className="mon-btn-refresh-label">Auto 30s</span>
          </label>
          <button onClick={() => load(true)} className="mon-btn-refresh" style={{ padding: '7px 11px', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: refreshing ? 'rgba(163,230,53,.1)' : 'var(--bg-input)', border: `1px solid ${refreshing ? 'var(--neon)' : 'var(--border)'}`, color: refreshing ? 'var(--neon)' : 'var(--txt-2)', fontFamily: "'Plus Jakarta Sans',sans-serif", transition: 'all .2s' }}>
            <span style={{ display: 'inline-block', transition: 'transform .5s', transform: refreshing ? 'rotate(360deg)' : 'none' }}>↻</span>
            <span className="mon-btn-refresh-label"> Atualizar</span>
          </button>
        </div>
      </div>

      {/* ── main ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10, color: 'var(--txt-2)' }}>
            <span className="spinner" style={{ width: 18, height: 18 }}/><span style={{ fontSize: 13 }}>Carregando métricas...</span>
          </div>
        ) : <>

          {/* ══ 1. STORAGE ══ */}
          <div>
            <SectionLabel>Limites do plano gratuito</SectionLabel>
            <div className="mon-storage-grid">

              {/* Supabase */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,var(--neon),rgba(163,230,53,.4))', borderRadius: '14px 14px 0 0' }}/>
                {/* logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--neon-dim)', border: '1px solid var(--neon-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5z" fill="#A3E635"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#A3E635" strokeWidth="2" strokeLinecap="round"/></svg>
                  </div>
                  <div>
                    <div className="font-display" style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt)' }}>Supabase — Banco de dados</div>
                    <div style={{ fontSize: 10, color: 'var(--txt-3)', marginTop: 1 }}>Free tier · limite 500 MB</div>
                  </div>
                </div>
                {/* ring + numbers */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
                  <Ring p={sbPct} color="var(--neon)" label={`${sbPct}%`} sub="usado"/>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                      <span className="font-display" style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, color: 'var(--neon)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em' }}>{sbUsedMB}</span>
                      <span style={{ fontSize: 18, fontWeight: 500, opacity: .6 }}>MB</span>
                      <span style={{ fontSize: 14, color: 'var(--txt-3)', fontWeight: 500 }}>/ 500 MB</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--txt-3)', marginBottom: 14 }}>
                      restam <strong style={{ color: 'var(--txt)' }}>{sbLeftMB} MB</strong> disponíveis
                    </div>
                    <BarTrack value={sbPct} color="linear-gradient(90deg,var(--neon),rgba(163,230,53,.45))"/>
                  </div>
                </div>
                {/* breakdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {sb?.tables.slice(0, 3).map((t, i) => {
                    const colors = ['var(--neon)', 'rgba(163,230,53,.55)', 'var(--txt-3)']
                    const p2 = sb ? pct(t.totalBytes, sb.dbSizeBytes) : 0
                    return (
                      <div key={t.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 7, height: 7, borderRadius: '50%', background: colors[i], flexShrink: 0 }}/>
                        <span style={{ fontSize: 12, color: 'var(--txt-2)', flex: 1 }}>Tabela &quot;{t.name}&quot;</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt)', fontVariantNumeric: 'tabular-nums' }}>{fmtBytes(t.totalBytes)}</span>
                        <span style={{ fontSize: 10, color: 'var(--txt-3)', width: 32, textAlign: 'right' as const }}>{p2}%</span>
                      </div>
                    )
                  })}
                </div>
                <AlertBanner pct={sbPct} msgs={
                  sbPct >= 90 ? 'Atenção! Banco próximo do limite — considere upgrade'
                  : sbPct >= 70 ? 'Uso elevado — monitore nos próximos dias'
                  : 'Uso normal — sem risco de limite'
                }/>
              </div>

              {/* Cloudflare R2 */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 20, position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'linear-gradient(90deg,#f6821f,#e55a1b)', borderRadius: '14px 14px 0 0' }}/>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(246,130,31,.12)', border: '1px solid rgba(246,130,31,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="15" height="13" viewBox="0 0 32 28" fill="none"><path d="M16 0L32 9v10L16 28 0 19V9L16 0z" fill="#f6821f" opacity=".25"/><path d="M16 0L32 9v10L16 28" stroke="#f6821f" strokeWidth="2"/><path d="M16 0L0 9v10l16 9" stroke="#f48120" strokeWidth="2"/><path d="M0 9l16 9 16-9" stroke="#f6821f" strokeWidth="2"/></svg>
                  </div>
                  <div>
                    <div className="font-display" style={{ fontSize: 12, fontWeight: 700, color: 'var(--txt)' }}>Cloudflare R2 — Mídias</div>
                    <div style={{ fontSize: 10, color: 'var(--txt-3)', marginTop: 1 }}>Free tier · limite 10 GB</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
                  <Ring p={r2Pct} color="#f6821f" label={`${r2Pct}%`} sub="usado"/>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                      <span className="font-display" style={{ fontSize: 40, fontWeight: 700, lineHeight: 1, color: '#f6821f', fontVariantNumeric: 'tabular-nums', letterSpacing: '-.02em' }}>{r2UsedGB}</span>
                      <span style={{ fontSize: 18, fontWeight: 500, opacity: .6 }}>GB</span>
                      <span style={{ fontSize: 14, color: 'var(--txt-3)', fontWeight: 500 }}>/ 10 GB</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--txt-3)', marginBottom: 14 }}>
                      restam <strong style={{ color: 'var(--txt)' }}>{r2LeftGB} GB</strong> disponíveis
                    </div>
                    <BarTrack value={r2Pct} color="linear-gradient(90deg,#f6821f,#e55a1b)"/>
                  </div>
                </div>
                {r2 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#f6821f', flexShrink: 0 }}/>
                      <span style={{ fontSize: 12, color: 'var(--txt-2)', flex: 1 }}>Total de arquivos</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt)', fontVariantNumeric: 'tabular-nums' }}>{r2.objectCount.toLocaleString('pt-BR')}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#e55a1b', flexShrink: 0 }}/>
                      <span style={{ fontSize: 12, color: 'var(--txt-2)', flex: 1 }}>Storage usado</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt)' }}>{fmtBytes(r2.storageBytes)}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, padding: '10px 0' }}>
                    {apiErrors.r2
                      ? <span style={{ color: '#ef4444' }}>Erro API: {apiErrors.r2}</span>
                      : <span style={{ color: 'var(--txt-3)' }}>Configure <code style={{ fontSize: 11, background: 'var(--bg-input)', padding: '1px 6px', borderRadius: 4 }}>CLOUDFLARE_ACCOUNT_ID</code> e <code style={{ fontSize: 11, background: 'var(--bg-input)', padding: '1px 6px', borderRadius: 4 }}>CLOUDFLARE_API_TOKEN</code> nas variáveis de ambiente da Vercel.</span>
                    }
                  </div>
                )}
                <AlertBanner pct={r2Pct} msgs={
                  r2Pct >= 90 ? 'Atenção! Storage R2 próximo do limite — configure lifecycle policy'
                  : r2Pct >= 70 ? 'Uso elevado — considere configurar lifecycle policy no R2'
                  : 'Uso normal — sem risco de limite'
                }/>
              </div>
            </div>
          </div>

          {/* ══ 2. MÉTRICAS ══ */}
          <div>
            <SectionLabel>Métricas do sistema</SectionLabel>
            <div className="mon-metrics-grid">

              <MetricCard
                stripe="linear-gradient(90deg,var(--neon),rgba(163,230,53,.4))" border="var(--neon-border)"
                label="Conexões<br/>banco de dados" value={String(connVal)} unit="" maxLabel={`/ ${CONN_LIMIT} simultâneas`}
                barPct={connPct} barColor={connColor}
                sub={`${connPct}% do limite · idle: ${sb?.connections.idle ?? '—'} · active: ${sb?.connections.active ?? '—'}`}
                popTitle="Conexões ao banco" popId="pop-conn" openPop={openPop} onTogglePop={togglePop}
              >
                Cada vez que o ComAgente busca mensagens ou salva dados, ele abre uma <strong>conexão</strong> com o Supabase. O plano gratuito permite <strong>100 simultâneas</strong>. Se atingir o limite, novas requisições falham — o chat pode travar.
                <br/><br/>Abaixo de 30 é seguro. Acima de 80, investigue.
              </MetricCard>

              <MetricCard
                stripe="linear-gradient(90deg,var(--neon),rgba(163,230,53,.4))" border="var(--neon-border)"
                label="Mensagens<br/>último minuto" value={String(mpmVal)} unit="msgs/min" maxLabel=""
                barPct={Math.min(mpmVal * 2, 100)} barColor={mpmColor}
                sub={`${msg?.perHour ?? '—'} na última hora · ${mpmVal > 40 ? 'pico detectado' : 'volume normal'}`}
                popTitle="Volume de mensagens" popId="pop-mpm" openPop={openPop} onTogglePop={togglePop}
              >
                Quantas mensagens chegaram via WhatsApp no <strong>último minuto</strong>. Mostra se o fluxo está normal ou se houve um <strong>pico</strong> (ex: disparo em massa). Um pico muito alto pode indicar spam ou loop de bot.
              </MetricCard>

              <MetricCard
                stripe="linear-gradient(90deg,#ef4444,#dc2626)" border="rgba(239,68,68,.25)"
                label="Erros de upload<br/>de mídia hoje" value={String(errVal)} unit={errVal === 1 ? 'erro' : 'erros'} maxLabel="· meta: 0"
                barPct={Math.min(errVal * 4, 100)} barColor={errColor}
                sub={errVal === 0 ? 'Tudo funcionando — mídias no R2' : `${errVal} arquivo(s) ficaram como base64 no banco`}
                popTitle="Erros de upload de mídia" popId="pop-err" openPop={openPop} onTogglePop={togglePop}
              >
                Quando uma imagem ou áudio não consegue subir para o <strong>Cloudflare R2</strong>, fica salvo como texto no banco Supabase — ocupa até <strong>10× mais espaço</strong>. Qualquer número acima de 0 merece atenção.
              </MetricCard>

              <MetricCard
                stripe="linear-gradient(90deg,#a78bfa,#7c3aed)" border="rgba(167,139,250,.25)"
                label="Mensagens salvas<br/>no banco" value={msgRows} unit="" maxLabel={`· ${msgBytes}`}
                barPct={msgPctSB} barColor="#a78bfa"
                sub={`${msgPctSB}% do espaço total do banco — tabela que mais cresce`}
                popTitle="Histórico de mensagens" popId="pop-rows" openPop={openPop} onTogglePop={togglePop}
              >
                Total de mensagens gravadas no Supabase. É a tabela que <strong>mais cresce</strong> — cada mensagem trocada no WhatsApp vira uma linha aqui. Quando os <strong>500 MB</strong> do plano gratuito forem atingidos, será necessário fazer upgrade ou limpar mensagens antigas.
              </MetricCard>

              <MetricCard
                stripe="linear-gradient(90deg,#60a5fa,#3b82f6)" border="rgba(96,165,250,.25)"
                label="Arquivos<br/>no Cloudflare R2" value={r2 ? r2.objectCount.toLocaleString('pt-BR') : '—'} unit="arquivos" maxLabel=""
                barPct={r2Pct} barColor="#60a5fa"
                sub={`${r2UsedGB} GB de 10 GB usados · bucket evolution-media-prod`}
                popTitle="Arquivos de mídia no R2" popId="pop-files" openPop={openPop} onTogglePop={togglePop}
              >
                Quantidade de arquivos (imagens, áudios, vídeos) armazenados no <strong>Cloudflare R2</strong>. Cada mídia recebida via WhatsApp gera um arquivo aqui. O plano gratuito tem <strong>10 GB</strong> de storage.
              </MetricCard>

              <MetricCard
                stripe="linear-gradient(90deg,#f59e0b,#d97706)" border="rgba(245,158,11,.25)"
                label="Instâncias<br/>conectadas" value={`${connectedInst}/${totalInst}`} unit="online" maxLabel=""
                barPct={totalInst ? pct(connectedInst, totalInst) : 0} barColor={connectedInst < totalInst ? '#f59e0b' : 'var(--neon)'}
                sub={connectedInst < totalInst ? `${totalInst - connectedInst} instância(s) desconectada(s) — escanear QR` : 'Todas as instâncias conectadas'}
                popTitle="Status das instâncias WhatsApp" popId="pop-inst" openPop={openPop} onTogglePop={togglePop}
              >
                Quantas instâncias WhatsApp estão <strong>ativas e recebendo mensagens</strong>. Uma instância desconectada significa que as mensagens daquele número não chegam ao sistema — é necessário escanear o QR Code novamente.
              </MetricCard>

            </div>
          </div>

          {/* ══ 3. INSTÂNCIAS ══ */}
          <div>
            <SectionLabel>Instâncias WhatsApp — Evolution API</SectionLabel>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
              <div style={{ padding: '13px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 className="font-display" style={{ fontSize: 13, fontWeight: 700, color: 'var(--txt)' }}>Conexões ativas</h2>
                <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>{connectedInst} de {totalInst} conectadas</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>Empresa</th>
                      <th style={th} className="mon-col-instance">Instância Evolution</th>
                      <th style={th}>Status</th>
                      <th style={th} className="mon-col-number">Número</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sb?.instances.map(inst => {
                      const connected = inst.connectionStatus === 'open'
                      const color  = connected ? '#10b981' : '#f59e0b'
                      const bg     = connected ? 'rgba(16,185,129,.08)'  : 'rgba(245,158,11,.08)'
                      const border = connected ? 'rgba(16,185,129,.25)'  : 'rgba(245,158,11,.25)'
                      const label  = connected ? 'Conectada' : 'Desconectada'
                      return (
                        <tr key={inst.name}
                          onMouseEnter={e => Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(c => (c as HTMLTableCellElement).style.background = 'var(--bg-hover)')}
                          onMouseLeave={e => Array.from((e.currentTarget as HTMLTableRowElement).cells).forEach(c => (c as HTMLTableCellElement).style.background = '')}
                        >
                          <td style={td}>
                            <div style={{ fontWeight: 600, color: 'var(--txt)', fontSize: 13 }}>{inst.name}</div>
                          </td>
                          <td style={{ ...td, fontFamily: 'monospace', fontSize: 11, color: '#60a5fa' }} className="mon-col-instance">{inst.name}</td>
                          <td style={td}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 99, background: bg, border: `1px solid ${border}`, color, textTransform: 'uppercase' as const, letterSpacing: '.02em' }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }}/>
                              {label}
                            </span>
                            {!connected && <div style={{ fontSize: 10, color: 'var(--txt-3)', marginTop: 4 }}>QR Code necessário</div>}
                          </td>
                          <td style={{ ...td, fontFamily: 'monospace', fontSize: 11 }} className="mon-col-number">—</td>
                        </tr>
                      )
                    })}
                    {(!sb?.instances.length) && (
                      <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: 'var(--txt-3)' }}>Nenhuma instância encontrada</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </>}
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.15} }

        /* ── grids responsivos ── */
        .mon-storage-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }
        .mon-metrics-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
        }

        /* tablet */
        @media (max-width: 860px) {
          .mon-metrics-grid { grid-template-columns: repeat(2, 1fr); }
        }

        /* mobile */
        @media (max-width: 560px) {
          .mon-storage-grid { grid-template-columns: 1fr; }
          .mon-metrics-grid { grid-template-columns: 1fr; }
          .mon-btn-refresh-label { display: none; }
          .mon-ts { display: none; }
        }

        /* ── light mode: bordas e sombras nos cards ── */
        :root[data-theme="light"] .mon-storage-grid > div,
        :root[data-theme="light"] .mon-metrics-grid > div {
          box-shadow: 0 1px 4px rgba(0,0,0,.07);
        }

        /* ── toolbar mobile ── */
        @media (max-width: 560px) {
          .mon-toolbar-right { display: none !important; }
          .mon-toolbar-refresh { display: flex !important; }
        }

        /* ── tabela instâncias: esconder colunas secundárias no mobile ── */
        @media (max-width: 560px) {
          .mon-col-instance, .mon-col-number { display: none; }
        }
      `}</style>
    </div>
  )
}
