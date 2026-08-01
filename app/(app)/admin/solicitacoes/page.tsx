'use client'
import { useEffect, useState, useRef } from 'react'

const SECTIONS_LABELS = [
  'Escopo de Serviços','Diferenciação','Primeiro Contato','Processos','Identidade Visual',
  'Área e Capacidade','Regras da IA','Transição','Autonomia da IA','Pós-Venda','Tom de Voz','Visão de Futuro',
]

type DiagInfo = { id: string; token: string; status: 'pending' | 'answered'; respondedAt: string } | null

type Lead = {
  id: string; name: string; email: string; phone: string
  company: string; planId: string; planName: string
  status: 'new' | 'contacted' | 'converted' | 'lost'
  createdAt: string; diagnostico: DiagInfo
}

const ST_CLR: Record<Lead['status'], string> = { new:'#a3e635', contacted:'#60a5fa', converted:'#10B981', lost:'#EF4444' }
const ST_LBL: Record<Lead['status'], string> = { new:'Novo', contacted:'Contatado', converted:'Aprovado', lost:'Recusado' }

function fmtDate(iso: string) { try { return new Date(iso).toLocaleDateString('pt-BR') } catch { return '—' } }

function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', backdropFilter:'blur(4px)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card animate-slide-up" style={{ maxWidth: wide ? 700 : 520, width:'100%', maxHeight:'90vh', overflowY:'auto', padding:0 }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, background:'var(--bg-card)', zIndex:1 }}>
          <h2 className="font-display" style={{ fontSize:15, fontWeight:700, color:'var(--txt)' }}>{title}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'var(--txt-2)', lineHeight:1 }}>×</button>
        </div>
        <div style={{ padding:20 }}>{children}</div>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, type='text', placeholder='' }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--txt-2)', marginBottom:5 }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ width:'100%', padding:'9px 12px' }} />
    </div>
  )
}

export default function SolicitacoesPage() {
  const [leads,      setLeads]      = useState<Lead[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filter,     setFilter]     = useState<'all' | Lead['status']>('all')
  const [search,     setSearch]     = useState('')
  const [toast,      setToast]      = useState('')
  const [openDrop,   setOpenDrop]   = useState<string | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [modal,      setModal]      = useState<'detalhes' | 'diagnostico' | 'aprovar' | 'recusar' | 'enviar-diag' | null>(null)
  const [selected,   setSelected]   = useState<Lead | null>(null)
  const [diagData,   setDiagData]   = useState<Record<string, string>>({})
  const [diagLoad,   setDiagLoad]   = useState(false)
  const [editName,   setEditName]   = useState('')
  const [editEmail,  setEditEmail]  = useState('')
  const [editPhone,  setEditPhone]  = useState('')
  const [editCompany,setEditCompany]= useState('')
  const [editPlan,   setEditPlan]   = useState('')
  const [editErr,    setEditErr]    = useState('')
  const dropRef = useRef<HTMLDivElement>(null)

  function showToast(m: string) { setToast(m); setTimeout(() => setToast(''), 3500) }

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/leads-com-diagnostico')
      const d = await r.json()
      if (d.success) setLeads(d.data as Lead[])
    } catch {}
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpenDrop(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function openModal(type: typeof modal, lead: Lead) {
    setSelected(lead); setModal(type); setEditErr(''); setOpenDrop(null)
    if (type === 'detalhes') {
      setEditName(lead.name); setEditEmail(lead.email)
      setEditPhone(lead.phone); setEditCompany(lead.company); setEditPlan(lead.planName)
    }
    if (type === 'diagnostico' && lead.diagnostico?.status === 'answered') loadDiag(lead.diagnostico.id)
  }

  async function loadDiag(diagId: string) {
    setDiagLoad(true); setDiagData({})
    try {
      const r = await fetch(`/api/admin/diagnostico/${diagId}`)
      const d = await r.json()
      if (d.success) { try { setDiagData(JSON.parse(d.data.responses)) } catch {} }
    } catch {}
    finally { setDiagLoad(false) }
  }

  async function saveDetalhes() {
    if (!selected) return
    setSaving(true); setEditErr('')
    const r = await fetch(`/api/admin/leads/${selected.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName, email: editEmail, phone: editPhone, company: editCompany, planName: editPlan }),
    })
    const d = await r.json(); setSaving(false)
    if (d.success) { setModal(null); load(); showToast('✓ Lead atualizado!') }
    else setEditErr(d.error ?? 'Erro ao salvar')
  }

  async function changeStatus(lead: Lead, status: Lead['status']) {
    setSaving(true)
    const r = await fetch(`/api/admin/leads/${lead.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const d = await r.json(); setSaving(false)
    if (d.success) {
      setModal(null); load()
      showToast(status === 'converted' ? '✓ Solicitação aprovada!' : '✓ Solicitação recusada.')
    } else showToast(`Erro: ${d.error}`)
  }

  const filtered = leads
    .filter(l => filter === 'all' || l.status === filter)
    .filter(l => !search || l.company.toLowerCase().includes(search.toLowerCase()) || l.name.toLowerCase().includes(search.toLowerCase()) || l.email.toLowerCase().includes(search.toLowerCase()))

  const counts = {
    total:     leads.length,
    new:       leads.filter(l => l.status === 'new').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    converted: leads.filter(l => l.status === 'converted').length,
    lost:      leads.filter(l => l.status === 'lost').length,
  }

  const th: React.CSSProperties = { padding:'10px 16px', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'.07em', color:'var(--txt-3)', textAlign:'left', background:'var(--bg-card)', position:'sticky', top:0, zIndex:5, borderBottom:'1px solid var(--border)' }
  const td: React.CSSProperties = { padding:'12px 16px', fontSize:13, color:'var(--txt-2)', verticalAlign:'middle' }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>

      {/* Toolbar */}
      <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, flexShrink:0, background:'var(--bg-card)', flexWrap:'wrap' }}>
        <div style={{ flex:1 }}>
          <div className="font-display" style={{ fontSize:16, fontWeight:700, color:'var(--txt)' }}>Solicitações</div>
          <div style={{ fontSize:11, color:'var(--txt-2)', marginTop:2 }}>{counts.total} solicitações · {counts.new} novas</div>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar empresa ou nome..." style={{ padding:'8px 12px', borderRadius:8, fontSize:13, width:220 }} />
        <select value={filter} onChange={e => setFilter(e.target.value as any)} style={{ padding:'8px 12px', borderRadius:8, fontSize:13, background:'var(--bg-input)', border:'1px solid var(--border)', color:'var(--txt)', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
          <option value="all">Todos</option>
          <option value="new">Novos</option>
          <option value="contacted">Contatados</option>
          <option value="converted">Aprovados</option>
          <option value="lost">Recusados</option>
        </select>
        <button onClick={load} style={{ padding:'8px 12px', borderRadius:8, fontSize:12, cursor:'pointer', background:'var(--bg-input)', border:'1px solid var(--border)', color:'var(--txt-2)', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>↻</button>
      </div>

      {/* Stats */}
      <div style={{ padding:'10px 20px', borderBottom:'1px solid var(--border)', display:'flex', gap:24, flexShrink:0, background:'var(--bg-card)', flexWrap:'wrap' }}>
        {([['Total', counts.total, 'var(--txt)'], ['Novos', counts.new, '#a3e635'], ['Contatados', counts.contacted, '#60a5fa'], ['Aprovados', counts.converted, '#10B981'], ['Recusados', counts.lost, '#EF4444']] as const).map(([l, v, c]) => (
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
              <tr>{['Empresa / Gestor', 'E-mail / Telefone', 'Diagnóstico', 'Plano', 'Cadastro', 'Status', 'Ações'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ ...td, textAlign:'center', padding:40, color:'var(--txt-3)' }}>Nenhuma solicitação encontrada.</td></tr>
              ) : filtered.map(lead => {
                const diag = lead.diagnostico
                const clr  = ST_CLR[lead.status]
                return (
                  <tr key={lead.id} style={{ borderBottom:'1px solid var(--border)', transition:'background .12s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-hover)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}>

                    <td style={td}>
                      <div style={{ fontWeight:600, color:'var(--txt)', fontSize:13 }}>{lead.company}</div>
                      <div style={{ fontSize:12, color:'var(--txt-2)', marginTop:1 }}>{lead.name}</div>
                    </td>

                    <td style={td}>
                      <div style={{ fontSize:12, color:'var(--txt)' }}>{lead.email}</div>
                      <div style={{ fontSize:11, color:'var(--txt-3)', marginTop:1 }}>{lead.phone}</div>
                    </td>

                    <td style={td}>
                      {!diag ? (
                        <span style={{ color:'var(--txt-3)', fontSize:12 }}>—</span>
                      ) : diag.status === 'answered' ? (
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:100, background:'#10B98118', border:'1px solid #10B98140', color:'#10B981' }}>
                            <span style={{ width:5, height:5, borderRadius:'50%', background:'#10B981' }} />Respondido
                          </span>
                          <button onClick={() => openModal('diagnostico', lead)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--txt-3)', fontSize:15, padding:'0 2px', lineHeight:1 }} title="Ver diagnóstico">···</button>
                        </div>
                      ) : (
                        <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:100, background:'#F59E0B18', border:'1px solid #F59E0B40', color:'#F59E0B' }}>
                          <span style={{ width:5, height:5, borderRadius:'50%', background:'#F59E0B' }} />Pendente
                        </span>
                      )}
                    </td>

                    <td style={{ ...td, fontSize:12 }}>{lead.planName}</td>
                    <td style={{ ...td, fontSize:12 }}>{fmtDate(lead.createdAt)}</td>

                    <td style={td}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:100, background:`${clr}18`, border:`1px solid ${clr}40`, color:clr }}>
                        <span style={{ width:5, height:5, borderRadius:'50%', background:clr }} />{ST_LBL[lead.status]}
                      </span>
                    </td>

                    <td style={td}>
                      <div style={{ position:'relative' }} ref={openDrop === lead.id ? dropRef : undefined}>
                        <button onClick={() => setOpenDrop(openDrop === lead.id ? null : lead.id)}
                          style={{ padding:'5px 12px', borderRadius:8, fontSize:12, fontWeight:600, border:'1px solid var(--border-md)', background:'var(--bg-input)', color:'var(--txt)', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
                          Opções ▾
                        </button>
                        {openDrop === lead.id && (
                          <div style={{ position:'absolute', right:0, top:'100%', marginTop:4, background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:10, padding:'4px 0', zIndex:50, minWidth:160, boxShadow:'0 8px 24px rgba(0,0,0,.3)' }}>
                            <DropBtn label="Detalhes / Editar" onClick={() => openModal('detalhes', lead)} />
                            {diag?.status === 'answered' && <DropBtn label="Ver Diagnóstico" onClick={() => openModal('diagnostico', lead)} />}
                            <DropBtn label="↗ Diagnóstico" onClick={() => openModal('enviar-diag', lead)} />
                            {lead.status !== 'converted' && <DropBtn label="Aprovar" color="#10B981" onClick={() => openModal('aprovar', lead)} />}
                            {lead.status !== 'lost'      && <DropBtn label="Recusar"  color="#EF4444" onClick={() => openModal('recusar', lead)} />}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: Detalhes / Editar */}
      {modal === 'detalhes' && selected && (
        <Modal title={`Detalhes — ${selected.company}`} onClose={() => setModal(null)}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <Field label="Nome" value={editName} onChange={setEditName} />
            <Field label="Empresa" value={editCompany} onChange={setEditCompany} />
            <Field label="E-mail" value={editEmail} onChange={setEditEmail} type="email" />
            <Field label="Telefone" value={editPhone} onChange={setEditPhone} />
          </div>
          <Field label="Plano" value={editPlan} onChange={setEditPlan} />
          <div style={{ fontSize:11, color:'var(--txt-3)', marginBottom:16 }}>
            Cadastrado em: {new Date(selected.createdAt).toLocaleString('pt-BR', { timeZone:'America/Sao_Paulo' })}
          </div>
          {editErr && <p style={{ fontSize:12, color:'var(--danger)', background:'var(--danger-dim)', border:'1px solid rgba(220,38,38,.2)', borderRadius:8, padding:'8px 12px', marginBottom:12 }}>{editErr}</p>}
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => setModal(null)} className="btn-outline" style={{ flex:1, padding:'10px', fontSize:13 }}>Cancelar</button>
            <button onClick={saveDetalhes} disabled={saving} className="btn-neon" style={{ flex:1, padding:'10px', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {saving ? <><span className="spinner" style={{ width:14, height:14 }} />Salvando...</> : 'Salvar alterações'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal: Diagnóstico */}
      {modal === 'diagnostico' && selected && (
        <Modal title={`Diagnóstico — ${selected.company}`} onClose={() => { setModal(null); setDiagData({}) }} wide>
          <div id="diag-print-area">
            <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:16 }} className="no-print">
              <button onClick={() => window.print()} className="btn-outline" style={{ padding:'7px 16px', fontSize:12 }}>Baixar PDF</button>
            </div>
            <div className="print-only" style={{ display:'none', marginBottom:24 }}>
              <h1 style={{ fontSize:20, fontWeight:800 }}>Diagnóstico de Atendimento</h1>
              <p>{selected.company} · {selected.name}</p>
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

      {/* Modal: Aprovar */}
      {modal === 'aprovar' && selected && (
        <Modal title="Aprovar solicitação" onClose={() => setModal(null)}>
          <p style={{ fontSize:13, color:'var(--txt-2)', lineHeight:1.6, marginBottom:20 }}>
            Confirmar aprovação de <strong style={{ color:'var(--txt)' }}>{selected.company}</strong>?
            O status será atualizado para <strong style={{ color:'#10B981' }}>Aprovado</strong>.
          </p>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => setModal(null)} className="btn-outline" style={{ flex:1, padding:'10px', fontSize:13 }}>Cancelar</button>
            <button onClick={() => changeStatus(selected, 'converted')} disabled={saving} style={{ flex:1, padding:'10px', fontSize:13, fontWeight:700, borderRadius:8, cursor:'pointer', background:'#10B981', border:'1px solid #059669', color:'#fff', fontFamily:"'Plus Jakarta Sans',sans-serif", display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {saving ? <><span className="spinner" style={{ width:14, height:14 }} />Aprovando...</> : 'Confirmar Aprovação'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal: Recusar */}
      {modal === 'recusar' && selected && (
        <Modal title="Recusar solicitação" onClose={() => setModal(null)}>
          <p style={{ fontSize:13, color:'var(--txt-2)', lineHeight:1.6, marginBottom:20 }}>
            Confirmar recusa de <strong style={{ color:'var(--txt)' }}>{selected.company}</strong>?
            O status será atualizado para <strong style={{ color:'#EF4444' }}>Recusado</strong>.
          </p>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => setModal(null)} className="btn-outline" style={{ flex:1, padding:'10px', fontSize:13 }}>Cancelar</button>
            <button onClick={() => changeStatus(selected, 'lost')} disabled={saving} className="btn-danger" style={{ flex:1, padding:'10px', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {saving ? <><span className="spinner" style={{ width:14, height:14 }} />Recusando...</> : 'Confirmar Recusa'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal: Enviar Diagnóstico por e-mail */}
      {modal === 'enviar-diag' && selected && (
        <Modal title="↗ Enviar Diagnóstico" onClose={() => setModal(null)}>
          {!selected.diagnostico ? (
            <p style={{ fontSize:13, color:'var(--txt-3)', textAlign:'center', padding:'12px 0' }}>
              Nenhum diagnóstico gerado para este lead ainda.
            </p>
          ) : (
            <>
              <p style={{ fontSize:13, color:'var(--txt-2)', lineHeight:1.6, marginBottom:20 }}>
                Reenviar o link do diagnóstico por e-mail para{' '}
                <strong style={{ color:'var(--txt)' }}>{selected.name || selected.company}</strong>
                {' '}(<span style={{ color:'var(--txt-3)' }}>{selected.email}</span>)?
              </p>
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => setModal(null)} className="btn-outline" style={{ flex:1, padding:'10px', fontSize:13 }}>Cancelar</button>
                <button disabled={saving} className="btn-neon" style={{ flex:1, padding:'10px', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}
                  onClick={async () => {
                    setSaving(true)
                    const r = await fetch(`/api/admin/leads/${selected.id}`, { method: 'POST' })
                    const d = await r.json(); setSaving(false)
                    if (d.success) { setModal(null); showToast('✓ E-mail enviado!') }
                    else showToast(`Erro: ${d.error}`)
                  }}>
                  {saving ? <><span className="spinner" style={{ width:14, height:14 }} />Enviando...</> : '↗ Enviar e-mail'}
                </button>
              </div>
            </>
          )}
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

function DropBtn({ label, onClick, color }: { label: string; onClick: () => void; color?: string }) {
  return (
    <button onClick={onClick}
      style={{ display:'block', width:'100%', textAlign:'left', padding:'8px 14px', fontSize:13, background:'none', border:'none', cursor:'pointer', color: color ?? 'var(--txt)', fontFamily:"'Plus Jakarta Sans',sans-serif", whiteSpace:'nowrap' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--nav-active-bg)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
      {label}
    </button>
  )
}
