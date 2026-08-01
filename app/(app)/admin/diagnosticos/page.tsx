'use client'
import { useEffect, useState } from 'react'

const SECTIONS_LABELS = [
  'Escopo de Serviços','Diferenciação','Primeiro Contato','Processos','Identidade Visual',
  'Área e Capacidade','Regras da IA','Transição','Autonomia da IA','Pós-Venda','Tom de Voz','Visão de Futuro',
]

type DiagItem = {
  id: string; leadId: string; token: string
  status: 'pending' | 'answered'
  responses: string; createdAt: string; respondedAt: string
  lead?: { id: string; name: string; email: string; company: string }
}

function fmtDate(iso: string) { try { return new Date(iso).toLocaleDateString('pt-BR') } catch { return '—' } }

function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', backdropFilter:'blur(4px)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card animate-slide-up" style={{ maxWidth: wide ? 720 : 520, width:'100%', maxHeight:'90vh', overflowY:'auto', padding:0 }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, background:'var(--bg-card)', zIndex:1 }}>
          <h2 className="font-display" style={{ fontSize:15, fontWeight:700, color:'var(--txt)' }}>{title}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'var(--txt-2)', lineHeight:1 }}>×</button>
        </div>
        <div style={{ padding:20 }}>{children}</div>
      </div>
    </div>
  )
}

export default function DiagnosticosPage() {
  const [items,    setItems]    = useState<DiagItem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState<DiagItem | null>(null)
  const [diagData, setDiagData] = useState<Record<string, string>>({})
  const [diagLoad, setDiagLoad] = useState(false)
  const [toast,    setToast]    = useState('')

  function showToast(m: string) { setToast(m); setTimeout(() => setToast(''), 3500) }

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/leads-com-diagnostico')
      const d = await r.json()
      if (d.success) {
        const diags: DiagItem[] = d.data
          .filter((l: any) => l.diagnostico)
          .map((l: any) => ({
            ...l.diagnostico,
            lead: { id: l.id, name: l.name, email: l.email, company: l.company },
          }))
          .sort((a: DiagItem, b: DiagItem) => (a.status === 'answered' ? -1 : 1))
        setItems(diags)
      }
    } catch {}
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  async function openDiag(item: DiagItem) {
    setSelected(item); setDiagData({})
    if (item.status !== 'answered') return
    setDiagLoad(true)
    try {
      const r = await fetch(`/api/admin/diagnostico/${item.id}`)
      const d = await r.json()
      if (d.success) { try { setDiagData(JSON.parse(d.data.responses)) } catch {} }
    } catch {}
    finally { setDiagLoad(false) }
  }

  const answered = items.filter(i => i.status === 'answered').length
  const pending  = items.filter(i => i.status === 'pending').length

  const th: React.CSSProperties = { padding:'10px 16px', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'.07em', color:'var(--txt-3)', textAlign:'left', background:'var(--bg-card)', position:'sticky', top:0, zIndex:5, borderBottom:'1px solid var(--border)' }
  const td: React.CSSProperties = { padding:'12px 16px', fontSize:13, color:'var(--txt-2)', verticalAlign:'middle' }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>

      {/* Toolbar */}
      <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, flexShrink:0, background:'var(--bg-card)', flexWrap:'wrap' }}>
        <div style={{ flex:1 }}>
          <div className="font-display" style={{ fontSize:16, fontWeight:700, color:'var(--txt)' }}>Diagnósticos</div>
          <div style={{ fontSize:11, color:'var(--txt-2)', marginTop:2 }}>{items.length} diagnósticos · {answered} respondidos</div>
        </div>
        <button onClick={load} style={{ padding:'8px 12px', borderRadius:8, fontSize:12, cursor:'pointer', background:'var(--bg-input)', border:'1px solid var(--border)', color:'var(--txt-2)', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>↻</button>
      </div>

      {/* Stats */}
      <div style={{ padding:'10px 20px', borderBottom:'1px solid var(--border)', display:'flex', gap:24, flexShrink:0, background:'var(--bg-card)' }}>
        {([['Total', items.length, 'var(--txt)'], ['Respondidos', answered, '#10B981'], ['Pendentes', pending, '#F59E0B']] as const).map(([l, v, c]) => (
          <div key={l} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span className="font-display" style={{ fontSize:22, fontWeight:700, color:c }}>{v}</span>
            <span style={{ fontSize:12, color:'var(--txt-3)' }}>{l}</span>
          </div>
        ))}
      </div>

      {/* Tabela */}
      <div style={{ flex:1, overflowY:'auto' }}>
        {loading ? (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200, gap:10, color:'var(--txt-2)' }}>
            <span className="spinner" style={{ width:18, height:18 }} /><span style={{ fontSize:13 }}>Carregando...</span>
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>{['Empresa', 'Responsável', 'Status', 'Respondido em', 'Ações'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={5} style={{ ...td, textAlign:'center', padding:40, color:'var(--txt-3)' }}>Nenhum diagnóstico registrado ainda.</td></tr>
              ) : items.map(item => {
                const clr = item.status === 'answered' ? '#10B981' : '#F59E0B'
                const lbl = item.status === 'answered' ? 'Respondido' : 'Pendente'
                return (
                  <tr key={item.id} style={{ borderBottom:'1px solid var(--border)', transition:'background .12s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-hover)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}>
                    <td style={td}>
                      <div style={{ fontWeight:600, color:'var(--txt)', fontSize:13 }}>{item.lead?.company ?? '—'}</div>
                    </td>
                    <td style={td}>
                      <div style={{ fontSize:13, color:'var(--txt)' }}>{item.lead?.name ?? '—'}</div>
                      <div style={{ fontSize:11, color:'var(--txt-3)', marginTop:1 }}>{item.lead?.email ?? ''}</div>
                    </td>
                    <td style={td}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:100, background:`${clr}18`, border:`1px solid ${clr}40`, color:clr }}>
                        <span style={{ width:5, height:5, borderRadius:'50%', background:clr }} />{lbl}
                      </span>
                    </td>
                    <td style={{ ...td, fontSize:12 }}>{item.respondedAt ? fmtDate(item.respondedAt) : '—'}</td>
                    <td style={td}>
                      {item.status === 'answered' && (
                        <button onClick={() => openDiag(item)} className="btn-neon" style={{ padding:'5px 10px', fontSize:11, borderRadius:6 }}>
                          Visualizar
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal de visualização */}
      {selected && (
        <Modal title={`Diagnóstico — ${selected.lead?.company}`} onClose={() => { setSelected(null); setDiagData({}) }} wide>
          <div id="diag-print-area">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }} className="no-print">
              <p style={{ fontSize:12, color:'var(--txt-2)' }}>{selected.lead?.name} · {selected.lead?.email}</p>
              <button onClick={() => window.print()} className="btn-outline" style={{ padding:'7px 16px', fontSize:12 }}>Baixar PDF</button>
            </div>
            <div className="print-only" style={{ display:'none', marginBottom:24 }}>
              <h1 style={{ fontSize:20, fontWeight:800 }}>Diagnóstico de Atendimento</h1>
              <p>{selected.lead?.company} · {selected.lead?.name}</p>
              <p style={{ fontSize:12 }}>Impresso em {new Date().toLocaleDateString('pt-BR')}</p>
              <hr />
            </div>
            {diagLoad ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:120, gap:10, color:'var(--txt-2)' }}>
                <span className="spinner" style={{ width:18, height:18 }} /><span style={{ fontSize:13 }}>Carregando respostas...</span>
              </div>
            ) : (
              SECTIONS_LABELS.map((sLabel, si) => {
                const answers = Array.from({ length:4 }, (_, qi) => diagData[`${si + 1}.${qi + 1}`])
                if (answers.every(a => !a)) return null
                return (
                  <div key={si} style={{ marginBottom:20 }}>
                    <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:'var(--neon)', marginBottom:8 }}>
                      Seção {si + 1} · {sLabel}
                    </div>
                    {answers.map((val, qi) => val ? (
                      <div key={qi} style={{ marginBottom:12, paddingLeft:12, borderLeft:'2px solid var(--border)' }}>
                        <div style={{ fontSize:12, fontWeight:600, color:'var(--txt-2)', marginBottom:4 }}>Pergunta {qi + 1}</div>
                        <div style={{ fontSize:13, color:'var(--txt)', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{val}</div>
                      </div>
                    ) : null)}
                  </div>
                )
              })
            )}
          </div>
        </Modal>
      )}

      {toast && <div className="toast-base">{toast}</div>}

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #diag-print-area, #diag-print-area * { visibility: visible !important; }
          #diag-print-area { position: fixed; inset: 0; padding: 32px; background: #fff !important; color: #000 !important; }
          .no-print { display: none !important; }
          .print-only { display: block !important; }
        }
      `}</style>
    </div>
  )
}
