'use client'
import { useEffect, useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import type { AgendamentosData, AgendamentoRow } from '@/types'

const MONTHS    = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const DAYS_PT   = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb']

// ── Utilitários de data ────────────────────────────────────────
function normalizeDate(val: string): string | null {
  if (!val) return null
  const s = String(val).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s))               return s.slice(0, 10)
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (br)                                            return `${br[3]}-${br[2]}-${br[1]}`
  const d2 = s.match(/^(\d{2})-(\d{2})-(\d{4})/)
  if (d2)                                            return `${d2[3]}-${d2[2]}-${d2[1]}`
  const y2 = s.match(/^(\d{4})\/(\d{2})\/(\d{2})/)
  if (y2)                                            return `${y2[1]}-${y2[2]}-${y2[3]}`
  try { const d = new Date(s); if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10) } catch {}
  return null
}

function dayKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}

function dateToKey(d: Date): string { return d.toISOString().slice(0, 10) }

function fmtDatePT(iso: string): string {
  const [y, m, d] = iso.split('-')
  return `${d} de ${MONTHS[parseInt(m,10)-1]} de ${y}`
}

// ── Cor por status ─────────────────────────────────────────────
function statusColor(s: string): string {
  if (!s) return 'var(--txt-3)'
  if (/(confirm|agend|ativo|^ok$|^sim$)/i.test(s)) return 'var(--neon)'
  if (/(pend|aguard|process|analise)/i.test(s))     return '#F59E0B'
  if (/(cancel|recus|neg|não|nao)/i.test(s))        return '#EF4444'
  return 'var(--txt-3)'
}

// ── Estilos reutilizáveis ──────────────────────────────────────
const btnArrow: React.CSSProperties = {
  width:28, height:28, borderRadius:6, border:'1px solid var(--border)',
  background:'var(--bg-input)', color:'var(--txt-2)', cursor:'pointer',
  display:'flex', alignItems:'center', justifyContent:'center', fontSize:11,
  fontFamily:"'Plus Jakarta Sans',sans-serif",
}

export default function AgendamentosPage() {
  const { data: session } = useSession()
  const isSupervisor = session?.user?.role === 'supervisor' || session?.user?.role === 'master'

  const [data,        setData]        = useState<AgendamentosData | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')

  const now = new Date()
  const [view,          setView]          = useState<'month'|'week'|'year'>('month')
  const [year,          setYear]          = useState(now.getFullYear())
  const [month,         setMonth]         = useState(now.getMonth())
  const [weekDate,      setWeekDate]      = useState(now)
  const [onlyScheduled, setOnlyScheduled] = useState(false)
  const [selectedDay,   setSelectedDay]   = useState<string|null>(null)

  const [editRow,   setEditRow]   = useState<AgendamentoRow|null>(null)
  const [editData,  setEditData]  = useState<Record<string,string>>({})
  const [editSaving,setEditSaving]= useState(false)
  const [toast,     setToast]     = useState('')

  async function load() {
    setLoading(true); setError('')
    try {
      const r = await fetch('/api/agendamentos', { cache:'no-store' })
      const d = await r.json()
      if (d.success) setData(d.data)
      else setError(d.error || 'Erro ao carregar')
    } catch { setError('Erro de conexão') }
    finally  { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3200) }

  // ── Agrupamento por data ──────────────────────────────────────
  const byDay = useMemo(() => {
    if (!data?.dateCol) return new Map<string, AgendamentoRow[]>()
    const map = new Map<string, AgendamentoRow[]>()
    for (const rec of data.records) {
      const norm = normalizeDate(String(rec[data.dateCol] ?? ''))
      if (!norm) continue
      const arr = map.get(norm) ?? []; arr.push(rec); map.set(norm, arr)
    }
    return map
  }, [data])

  // ── Grades de calendário ──────────────────────────────────────
  const monthGrid = useMemo(() => {
    const firstDay    = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: (number|null)[] = [...Array(firstDay).fill(null)]
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    const weeks: (number|null)[][] = []
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i+7))
    return weeks
  }, [year, month])

  const weekDays = useMemo(() => {
    const start = new Date(weekDate)
    start.setDate(start.getDate() - start.getDay()) // domingo
    return Array.from({ length:7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate()+i); return d })
  }, [weekDate])

  function navMonth(dir: number) {
    let m = month + dir, y = year
    if (m < 0)  { m = 11; y-- }
    if (m > 11) { m = 0;  y++ }
    setMonth(m); setYear(y); setSelectedDay(null)
  }

  function navWeek(dir: number) {
    const d = new Date(weekDate); d.setDate(d.getDate() + dir*7)
    setWeekDate(d); setSelectedDay(null)
  }

  // ── Edit helpers ──────────────────────────────────────────────
  function openEdit(rec: AgendamentoRow) {
    if (!data) return
    const d: Record<string,string> = {}
    data.headers.forEach(h => { d[h] = String(rec[h] ?? '') })
    setEditRow(rec); setEditData(d)
  }

  async function saveEdit() {
    if (!editRow) return
    setEditSaving(true)
    try {
      const r = await fetch(`/api/agendamentos/${editRow._rowIndex}`, {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ updates: editData }),
      })
      const d = await r.json()
      if (d.success) { setEditRow(null); showToast('✓ Agendamento atualizado'); load() }
      else showToast(`Erro: ${d.error}`)
    } catch { showToast('Erro de conexão') }
    finally  { setEditSaving(false) }
  }

  const todayKey           = now.toISOString().slice(0, 10)
  const selectedDayRecords = selectedDay ? (byDay.get(selectedDay) ?? []) : []

  // ─────────────────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', gap:10, color:'var(--txt-2)' }}>
      <span className="spinner" style={{ width:18, height:18 }}/>
      <span style={{ fontSize:13 }}>Carregando agendamentos...</span>
    </div>
  )

  if (error || !data) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', padding:24 }}>
      <div className="card" style={{ maxWidth:440, width:'100%', padding:'36px 32px', textAlign:'center' }}>
        <div style={{ fontSize:40, marginBottom:16 }}>📅</div>
        <div className="font-display" style={{ fontSize:17, fontWeight:700, color:'var(--txt)', marginBottom:10 }}>Sem dados de agendamento</div>
        <p style={{ fontSize:13, color:'var(--txt-2)', lineHeight:1.7, marginBottom:24 }}>
          A aba <strong>Agendamentos</strong> ainda não está disponível ou não foi configurada para esta empresa.<br/>
          Entre em contato com a{' '}
          <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, color:'var(--txt)' }}>Com<span style={{ color:'var(--neon)' }}>Agente</span></span>
          {' '}para configurar.
        </p>
        <button className="btn-outline" onClick={load} style={{ padding:'9px 20px', fontSize:13 }}>↻ Tentar novamente</button>
      </div>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden' }}>

      {/* ── Barra de controles ──────────────────────────────────── */}
      <div style={{ padding:'10px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, flexShrink:0, background:'var(--bg-card)', flexWrap:'wrap' }}>

        {/* Navegação mês/semana */}
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <button style={btnArrow} onClick={() => view==='week' ? navWeek(-1) : view==='month' ? navMonth(-1) : setYear(y=>y-1)}>◀</button>
          <div style={{ minWidth:120, textAlign:'center' }}>
            <span className="font-display" style={{ fontSize:14, fontWeight:700, color:'var(--txt)' }}>
              {view==='month' ? `${MONTHS[month]} ${year}` :
               view==='week'  ? `${weekDays[0].getDate()}/${weekDays[0].getMonth()+1} – ${weekDays[6].getDate()}/${weekDays[6].getMonth()+1}/${year}` :
               `${year}`}
            </span>
          </div>
          <button style={btnArrow} onClick={() => view==='week' ? navWeek(1) : view==='month' ? navMonth(1) : setYear(y=>y+1)}>▶</button>
        </div>

        {/* Seletor de visão */}
        <div style={{ display:'flex', gap:2, background:'var(--bg-input)', borderRadius:8, padding:2 }}>
          {(['month','week','year'] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding:'5px 12px', borderRadius:6, fontSize:12, fontWeight:600,
              border:'none', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif",
              background: view===v ? 'var(--neon)' : 'transparent',
              color:       view===v ? '#0a1400'     : 'var(--txt-2)',
              transition: 'background .15s',
            }}>
              {v==='month' ? 'Mês' : v==='week' ? 'Semana' : 'Ano'}
            </button>
          ))}
        </div>

        {/* Toggle + ↻ justificados à direita */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginLeft:'auto' }}>
          <label style={{ display:'flex', alignItems:'center', gap:7, cursor:'pointer' }}>
            <div className={`ia-toggle ${onlyScheduled ? 'ia-toggle-on' : 'ia-toggle-off'}`} onClick={() => setOnlyScheduled(o=>!o)}/>
            <span style={{ fontSize:12, color:'var(--txt-2)' }}>Somente agendados</span>
          </label>
          <button onClick={load} style={{ ...btnArrow, fontSize:14 }}>↻</button>
        </div>

      </div>

      {/* ── Área principal: calendário + painel lateral ──────────── */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* Calendário */}
        <div style={{ flex:1, overflowY:'auto', padding:'16px 20px' }}>

          {/* ── Vista Mês ── */}
          {view==='month' && (
            <div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:4 }}>
                {DAYS_PT.map(d => (
                  <div key={d} style={{ textAlign:'center', fontSize:10, fontWeight:700, color:'var(--txt-3)', padding:'4px 0', letterSpacing:'.08em' }}>{d}</div>
                ))}
              </div>
              {monthGrid.map((week, wi) => (
                <div key={wi} style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:4, marginBottom:4 }}>
                  {week.map((day, di) => {
                    if (!day) return <div key={di}/>
                    const key  = dayKey(year, month, day)
                    const recs = byDay.get(key) ?? []
                    const isToday    = key === todayKey
                    const isSelected = key === selectedDay
                    if (onlyScheduled && recs.length===0) return (
                      <div key={di} style={{ minHeight:68, borderRadius:10, border:'1px solid transparent', opacity:.25 }}>
                        <div style={{ fontSize:12, color:'var(--txt-3)', padding:'6px 8px' }}>{day}</div>
                      </div>
                    )
                    return (
                      <button key={di} onClick={() => setSelectedDay(isSelected ? null : key)} style={{
                        minHeight:68, borderRadius:10, cursor:'pointer', textAlign:'left',
                        padding:'6px 8px', display:'flex', flexDirection:'column', gap:3,
                        border:`1px solid ${isSelected ? 'var(--neon)' : isToday ? 'rgba(163,230,53,.35)' : 'var(--border)'}`,
                        background: isSelected ? 'rgba(163,230,53,.1)' : isToday ? 'rgba(163,230,53,.04)' : 'var(--bg-card)',
                        transition:'border-color .12s, background .12s',
                      }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                          <span style={{ fontSize:13, fontWeight: isToday ? 700 : 500, color: isToday ? 'var(--neon)' : 'var(--txt)' }}>{day}</span>
                          {recs.length>0 && <span style={{ fontSize:9, fontWeight:700, background:'var(--neon)', color:'#0a1400', borderRadius:100, padding:'1px 5px' }}>{recs.length}</span>}
                        </div>
                        {recs.slice(0,2).map((rec,ri) => {
                          const statusVal  = data.statusCol ? String(rec[data.statusCol]??'') : ''
                          const nameHeader = data.headers.find(h => /nome|client/i.test(h))
                          const label      = nameHeader ? String(rec[nameHeader]??'') : statusVal
                          return (
                            <div key={ri} style={{ fontSize:10, borderRadius:4, padding:'2px 5px', background:`${statusColor(statusVal)}22`, color:statusColor(statusVal), whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                              {label || '—'}
                            </div>
                          )
                        })}
                        {recs.length>2 && <div style={{ fontSize:9, color:'var(--txt-3)' }}>+{recs.length-2} mais</div>}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          )}

          {/* ── Vista Semana ── */}
          {view==='week' && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:8, height:'100%' }}>
              {weekDays.map(d => {
                const key      = dateToKey(d)
                const recs     = byDay.get(key) ?? []
                const isToday  = key === todayKey
                const isSelected = key === selectedDay
                if (onlyScheduled && recs.length===0) return (
                  <div key={key} style={{ minHeight:240, borderRadius:10, border:'1px dashed var(--border)', opacity:.35 }}>
                    <div style={{ padding:'8px 10px', fontSize:11, color:'var(--txt-3)' }}>{DAYS_PT[d.getDay()]} {d.getDate()}</div>
                  </div>
                )
                return (
                  <div key={key} onClick={() => setSelectedDay(isSelected ? null : key)} style={{
                    minHeight:240, borderRadius:10, cursor:'pointer', overflow:'hidden',
                    border:`1px solid ${isSelected ? 'var(--neon)' : isToday ? 'rgba(163,230,53,.35)' : 'var(--border)'}`,
                    background: isSelected ? 'rgba(163,230,53,.07)' : 'var(--bg-card)',
                  }}>
                    <div style={{ padding:'8px 10px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                      <span style={{ fontSize:12, fontWeight:700, color: isToday ? 'var(--neon)' : 'var(--txt)' }}>{DAYS_PT[d.getDay()]} {d.getDate()}</span>
                      {recs.length>0 && <span style={{ fontSize:9, fontWeight:700, background:'var(--neon)', color:'#0a1400', borderRadius:100, padding:'1px 6px' }}>{recs.length}</span>}
                    </div>
                    <div style={{ padding:8 }}>
                      {recs.length===0 && <div style={{ fontSize:11, color:'var(--txt-3)', textAlign:'center', marginTop:24 }}>—</div>}
                      {recs.map((rec, ri) => {
                        const statusVal  = data.statusCol ? String(rec[data.statusCol]??'') : ''
                        const nameHeader = data.headers.find(h => /nome|client/i.test(h))
                        const label      = nameHeader ? String(rec[nameHeader]??'') : ''
                        return (
                          <div key={ri} style={{ marginBottom:6, padding:'6px 8px', borderRadius:6, background:'var(--bg-input)', borderLeft:`3px solid ${statusColor(statusVal)}` }}>
                            {label && <div style={{ fontSize:11, fontWeight:600, color:'var(--txt)', marginBottom:2 }}>{label}</div>}
                            {statusVal && <div style={{ fontSize:10, color:statusColor(statusVal) }}>{statusVal}</div>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Vista Ano ── */}
          {view==='year' && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:16 }}>
              {MONTHS.map((mName, mi) => {
                const daysInMonth = new Date(year, mi+1, 0).getDate()
                const monthKeys   = Array.from({length:daysInMonth}, (_,i) => dayKey(year, mi, i+1))
                const monthHasEv  = monthKeys.some(k => byDay.has(k))
                if (onlyScheduled && !monthHasEv) return null
                const firstDay = new Date(year, mi, 1).getDay()
                const cells    = [...Array(firstDay).fill(null), ...Array.from({length:daysInMonth},(_,i)=>i+1)]
                while (cells.length%7!==0) cells.push(null)
                return (
                  <div key={mi} className="card" style={{ padding:12, cursor:'default' }}>
                    <div style={{ fontSize:12, fontWeight:700, color:'var(--txt)', marginBottom:8 }}>{mName}</div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
                      {DAYS_PT.map(d=><div key={d} style={{ fontSize:8, color:'var(--txt-3)', textAlign:'center' }}>{d[0]}</div>)}
                      {cells.map((day,ci) => {
                        if (!day) return <div key={ci}/>
                        const k   = dayKey(year, mi, day)
                        const cnt = byDay.get(k)?.length ?? 0
                        const isToday = k === todayKey
                        return (
                          <button key={ci} title={cnt>0 ? `${cnt} agendamento${cnt>1?'s':''}` : undefined}
                            onClick={() => { if (cnt>0) { setMonth(mi); setView('month'); setSelectedDay(k) } }}
                            style={{
                              width:'100%', aspectRatio:'1', borderRadius:3, border:'none',
                              cursor: cnt>0 ? 'pointer' : 'default',
                              background: cnt>0 ? 'var(--neon)' : isToday ? 'rgba(163,230,53,.2)' : 'transparent',
                              color: cnt>0 ? '#0a1400' : isToday ? 'var(--neon)' : 'var(--txt-3)',
                              fontSize:9, fontFamily:"'Plus Jakarta Sans',sans-serif",
                              fontWeight: cnt>0 ? 700 : 400,
                            }}>
                            {day}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Painel lateral do dia selecionado ────────────────── */}
        {selectedDay && (
          <div style={{ width:290, borderLeft:'1px solid var(--border)', background:'var(--bg-card)', display:'flex', flexDirection:'column', flexShrink:0, overflow:'hidden' }}>
            <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)' }}>
              <div className="font-display" style={{ fontSize:14, fontWeight:700, color:'var(--txt)' }}>{fmtDatePT(selectedDay)}</div>
              <div style={{ fontSize:11, color:'var(--txt-2)', marginTop:2 }}>
                {selectedDayRecords.length === 0 ? 'Nenhum agendamento' : `${selectedDayRecords.length} agendamento${selectedDayRecords.length>1?'s':''}`}
              </div>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:10 }}>
              {selectedDayRecords.length===0 && (
                <div style={{ textAlign:'center', color:'var(--txt-3)', fontSize:12, marginTop:48 }}>📅<br/>Dia sem agendamentos</div>
              )}
              {selectedDayRecords.map((rec, ri) => (
                <div key={ri} className="card" style={{ padding:12, marginBottom:8 }}>
                  {data.headers.map(h => {
                    const val = String(rec[h] ?? '')
                    if (!val.trim()) return null
                    return (
                      <div key={h} style={{ marginBottom:6 }}>
                        <div style={{ fontSize:9, fontWeight:700, color:'var(--txt-3)', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:2 }}>
                          {h.replace(/_/g,' ')}
                        </div>
                        <div style={{ fontSize:12, color: h===data.statusCol ? statusColor(val) : 'var(--txt)', fontWeight: h===data.statusCol ? 600 : 400, wordBreak:'break-word' }}>
                          {val}
                        </div>
                      </div>
                    )
                  })}
                  {isSupervisor && (
                    <button onClick={() => openEdit(rec)} className="btn-outline" style={{ width:'100%', padding:'6px', fontSize:11, marginTop:6 }}>
                      ✏ Editar
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div style={{ padding:'10px', borderTop:'1px solid var(--border)' }}>
              <button onClick={() => setSelectedDay(null)} className="btn-outline" style={{ width:'100%', padding:'7px', fontSize:12 }}>Fechar</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal de edição ──────────────────────────────────────── */}
      {editRow && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', backdropFilter:'blur(4px)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e => { if (e.target===e.currentTarget) setEditRow(null) }}>
          <div className="card animate-slide-up" style={{ maxWidth:500, width:'100%', maxHeight:'85vh', display:'flex', flexDirection:'column', padding:0 }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <h2 className="font-display" style={{ fontSize:15, fontWeight:700, color:'var(--txt)' }}>Editar Agendamento</h2>
              <button onClick={()=>setEditRow(null)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'var(--txt-2)', lineHeight:1 }}>×</button>
            </div>
            <div style={{ padding:20, overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:12 }}>
              {data.headers.map(h => (
                <div key={h}>
                  <label style={{ display:'block', fontSize:10, fontWeight:700, color:'var(--txt-2)', marginBottom:4, textTransform:'uppercase', letterSpacing:'.07em' }}>
                    {h.replace(/_/g,' ')}
                  </label>
                  {h.toLowerCase()==='timestamp' ? (
                    <div style={{ fontSize:12, color:'var(--txt-3)', padding:'8px 10px', background:'var(--bg-hover)', borderRadius:8, border:'1px solid var(--border)' }}>
                      {editData[h] || '—'} <span style={{ fontSize:10, color:'var(--txt-3)' }}>(somente leitura)</span>
                    </div>
                  ) : (
                    <input type="text" value={editData[h]??''} onChange={e=>setEditData(d=>({...d,[h]:e.target.value}))}
                      style={{ width:'100%', padding:'8px 10px' }}/>
                  )}
                </div>
              ))}
            </div>
            <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', gap:10 }}>
              <button onClick={()=>setEditRow(null)} className="btn-outline" style={{ flex:1, padding:'9px', fontSize:13 }}>Cancelar</button>
              <button onClick={saveEdit} disabled={editSaving} className="btn-neon" style={{ flex:1, padding:'9px', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
                {editSaving ? <><span className="spinner" style={{ width:13, height:13 }}/>Salvando...</> : '✓ Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast-base">{toast}</div>}
    </div>
  )
}
