'use client'
import { useEffect, useState } from 'react'

const SECTION_LABELS = [
  'Escopo de Serviços','Diferenciação','Primeiro Contato','Processos','Identidade Visual',
  'Área e Capacidade','Regras da IA','Transição','Autonomia da IA','Pós-Venda','Tom de Voz','Visão de Futuro',
]

type DiagItem = {
  id: string; leadId: string; token: string
  status: 'pending' | 'answered'; responses: string
  createdAt: string; respondedAt: string
  lead?: { id: string; name: string; email: string; company: string }
}

type Question = {
  id: string; sectionIndex: number; sectionTitle: string
  sectionSubtitle: string; questionIndex: number; question: string
}

type Section = { title: string; subtitle: string; questions: Question[] }

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

function Field({ label, value, onChange, placeholder='', multiline=false }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--txt-2)', marginBottom:5 }}>{label}</label>
      {multiline
        ? <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3}
            style={{ width:'100%', padding:'9px 12px', borderRadius:8, border:'1px solid var(--border-md)', background:'var(--bg-input)', color:'var(--txt)', fontSize:13, resize:'vertical', boxSizing:'border-box', fontFamily:"'Plus Jakarta Sans',sans-serif" }} />
        : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            style={{ width:'100%', padding:'9px 12px' }} />
      }
    </div>
  )
}

export default function DiagnosticosPage() {
  const [tab,       setTab]       = useState<'diagnosticos' | 'perguntas'>('diagnosticos')

  // Diagnósticos recebidos
  const [diags,     setDiags]     = useState<DiagItem[]>([])
  const [diagLoad,  setDiagLoad]  = useState(true)
  const [selected,  setSelected]  = useState<DiagItem | null>(null)
  const [respData,  setRespData]  = useState<Record<string, string>>({})
  const [respLoad,  setRespLoad]  = useState(false)

  // Gestão de perguntas
  const [sections,  setSections]  = useState<Section[]>([])
  const [qLoad,     setQLoad]     = useState(false)
  const [editQ,     setEditQ]     = useState<Question | null>(null)
  const [editText,  setEditText]  = useState('')
  const [addModal,  setAddModal]  = useState(false)
  const [newSecIdx, setNewSecIdx] = useState(1)
  const [newQText,  setNewQText]  = useState('')
  const [delQ,      setDelQ]      = useState<Question | null>(null)
  const [saving,    setSaving]    = useState(false)

  const [toast, setToast] = useState('')
  function showToast(m: string) { setToast(m); setTimeout(() => setToast(''), 3500) }

  // ── Diagnósticos recebidos ────────────────────────────────
  async function loadDiags() {
    setDiagLoad(true)
    try {
      const r = await fetch('/api/admin/leads-com-diagnostico')
      const d = await r.json()
      if (d.success) {
        setDiags(d.data
          .filter((l: any) => l.diagnostico)
          .map((l: any) => ({ ...l.diagnostico, lead: { id:l.id, name:l.name, email:l.email, company:l.company } }))
          .sort((a: DiagItem, b: DiagItem) => (a.status === 'answered' ? -1 : 1)))
      }
    } catch {}
    finally { setDiagLoad(false) }
  }

  async function openResp(item: DiagItem) {
    setSelected(item); setRespData({})
    if (item.status !== 'answered') return
    setRespLoad(true)
    try {
      const r = await fetch(`/api/admin/diagnostico/${item.id}`)
      const d = await r.json()
      if (d.success) { try { setRespData(JSON.parse(d.data.responses)) } catch {} }
    } catch {}
    finally { setRespLoad(false) }
  }

  // ── Gestão de perguntas ────────────────────────────────────
  async function loadQuestions() {
    setQLoad(true)
    try {
      const r = await fetch('/api/admin/diagnostico-questions')
      const d = await r.json()
      if (d.success) {
        const grouped: Record<number, Section> = {}
        ;(d.data as Question[]).filter(q => q.id !== '_deleted').forEach(q => {
          if (!grouped[q.sectionIndex]) {
            grouped[q.sectionIndex] = { title: q.sectionTitle, subtitle: q.sectionSubtitle, questions: [] }
          }
          grouped[q.sectionIndex].questions.push(q)
          grouped[q.sectionIndex].questions.sort((a, b) => a.questionIndex - b.questionIndex)
        })
        setSections(Object.entries(grouped).sort(([a],[b]) => Number(a)-Number(b)).map(([,v]) => v))
      }
    } catch {}
    finally { setQLoad(false) }
  }

  useEffect(() => { loadDiags() }, [])
  useEffect(() => { if (tab === 'perguntas' && sections.length === 0) loadQuestions() }, [tab])

  async function saveEditQ() {
    if (!editQ || !editText.trim()) return
    setSaving(true)
    const r = await fetch(`/api/admin/diagnostico-questions/${editQ.id}`, {
      method: 'PATCH', headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ question: editText.trim() }),
    })
    const d = await r.json(); setSaving(false)
    if (d.success) { setEditQ(null); loadQuestions(); showToast('✓ Pergunta atualizada!') }
    else showToast(`Erro: ${d.error}`)
  }

  async function addQuestion() {
    if (!newQText.trim()) return
    setSaving(true)
    const sec = sections[newSecIdx - 1]
    const nextQIdx = sec ? (sec.questions.length + 1) : 1
    const r = await fetch('/api/admin/diagnostico-questions', {
      method: 'POST', headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ sectionIndex: newSecIdx, sectionTitle: sec?.title ?? `Seção ${newSecIdx}`, sectionSubtitle: sec?.subtitle ?? '', questionIndex: nextQIdx, question: newQText.trim() }),
    })
    const d = await r.json(); setSaving(false)
    if (d.success) { setAddModal(false); setNewQText(''); loadQuestions(); showToast('✓ Pergunta adicionada!') }
    else showToast(`Erro: ${d.error}`)
  }

  async function deleteQuestion() {
    if (!delQ) return
    setSaving(true)
    const r = await fetch(`/api/admin/diagnostico-questions/${delQ.id}`, { method: 'DELETE' })
    const d = await r.json(); setSaving(false)
    if (d.success) { setDelQ(null); loadQuestions(); showToast('✓ Pergunta excluída.') }
    else showToast(`Erro: ${d.error}`)
  }

  const answered = diags.filter(i => i.status === 'answered').length
  const pending  = diags.filter(i => i.status === 'pending').length
  const totalQ   = sections.reduce((s, sec) => s + sec.questions.length, 0)

  const th: React.CSSProperties = { padding:'10px 16px', fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:'.07em', color:'var(--txt-3)', textAlign:'left', background:'var(--bg-card)', position:'sticky', top:0, zIndex:5, borderBottom:'1px solid var(--border)' }
  const td: React.CSSProperties = { padding:'12px 16px', fontSize:13, color:'var(--txt-2)', verticalAlign:'middle' }

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>

      {/* Toolbar */}
      <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, flexShrink:0, background:'var(--bg-card)', flexWrap:'wrap' }}>
        <div style={{ flex:1 }}>
          <div className="font-display" style={{ fontSize:16, fontWeight:700, color:'var(--txt)' }}>Diagnósticos</div>
          <div style={{ fontSize:11, color:'var(--txt-2)', marginTop:2 }}>{diags.length} diagnósticos · {answered} respondidos · {totalQ} perguntas</div>
        </div>
        {tab === 'perguntas' && (
          <button onClick={() => setAddModal(true)} className="btn-neon" style={{ padding:'9px 16px', fontSize:13 }}>+ Adicionar Pergunta</button>
        )}
        <button onClick={() => { tab === 'diagnosticos' ? loadDiags() : loadQuestions() }}
          style={{ padding:'8px 12px', borderRadius:8, fontSize:12, cursor:'pointer', background:'var(--bg-input)', border:'1px solid var(--border)', color:'var(--txt-2)', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>↻</button>
      </div>

      {/* Stats */}
      <div style={{ padding:'10px 20px', borderBottom:'1px solid var(--border)', display:'flex', gap:24, flexShrink:0, background:'var(--bg-card)', flexWrap:'wrap', alignItems:'center' }}>
        {([['Total', diags.length, 'var(--txt)'], ['Respondidos', answered, '#10B981'], ['Pendentes', pending, '#F59E0B'], ['Perguntas', totalQ, '#60a5fa']] as const).map(([l, v, c]) => (
          <div key={l} style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span className="font-display" style={{ fontSize:22, fontWeight:700, color:c }}>{v}</span>
            <span style={{ fontSize:12, color:'var(--txt-3)' }}>{l}</span>
          </div>
        ))}
        {/* Tabs */}
        <div style={{ marginLeft:'auto', display:'flex', gap:4 }}>
          {(['diagnosticos', 'perguntas'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding:'6px 14px', borderRadius:8, fontSize:12, fontWeight:600, cursor:'pointer',
              border:`1px solid ${tab === t ? 'var(--neon-border)' : 'var(--border)'}`,
              background: tab === t ? 'var(--neon-dim)' : 'transparent',
              color: tab === t ? 'var(--neon)' : 'var(--txt-2)',
              fontFamily:"'Plus Jakarta Sans',sans-serif",
            }}>
              {t === 'diagnosticos' ? 'Diagnósticos' : 'Perguntas'}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ flex:1, overflowY:'auto' }}>

        {/* ABA: Diagnósticos recebidos */}
        {tab === 'diagnosticos' && (
          diagLoad ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200, gap:10, color:'var(--txt-2)' }}>
              <span className="spinner" style={{ width:18, height:18 }} /><span style={{ fontSize:13 }}>Carregando...</span>
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr>{['Empresa', 'Responsável', 'Status', 'Respondido em', 'Ações'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {diags.length === 0 ? (
                  <tr><td colSpan={5} style={{ ...td, textAlign:'center', padding:40, color:'var(--txt-3)' }}>Nenhum diagnóstico registrado ainda.</td></tr>
                ) : diags.map(item => {
                  const clr = item.status === 'answered' ? '#10B981' : '#F59E0B'
                  const lbl = item.status === 'answered' ? 'Respondido' : 'Pendente'
                  return (
                    <tr key={item.id} style={{ borderBottom:'1px solid var(--border)', transition:'background .12s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-hover)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}>
                      <td style={td}><div style={{ fontWeight:600, color:'var(--txt)', fontSize:13 }}>{item.lead?.company ?? '—'}</div></td>
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
                          <button onClick={() => openResp(item)} className="btn-neon" style={{ padding:'5px 10px', fontSize:11, borderRadius:6 }}>Visualizar</button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )
        )}

        {/* ABA: Gestão de Perguntas */}
        {tab === 'perguntas' && (
          qLoad ? (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200, gap:10, color:'var(--txt-2)' }}>
              <span className="spinner" style={{ width:18, height:18 }} /><span style={{ fontSize:13 }}>Carregando perguntas...</span>
            </div>
          ) : (
            <div style={{ padding:20 }}>
              {sections.map((sec, si) => (
                <div key={si} className="card" style={{ padding:0, marginBottom:16, overflow:'hidden' }}>
                  <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', background:'var(--bg-input)', display:'flex', alignItems:'center', gap:10 }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:'var(--neon)', textTransform:'uppercase', letterSpacing:'.08em' }}>Seção {si + 1}</div>
                      <div className="font-display" style={{ fontSize:14, fontWeight:700, color:'var(--txt)' }}>{sec.title}</div>
                      {sec.subtitle && <div style={{ fontSize:11, color:'var(--txt-3)', marginTop:1 }}>{sec.subtitle}</div>}
                    </div>
                    <span style={{ marginLeft:'auto', fontSize:11, color:'var(--txt-3)' }}>{sec.questions.length} pergunta{sec.questions.length !== 1 ? 's' : ''}</span>
                  </div>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <tbody>
                      {sec.questions.map((q, qi) => (
                        <tr key={q.id} style={{ borderBottom: qi < sec.questions.length - 1 ? '1px solid var(--border)' : 'none', transition:'background .12s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'var(--bg-hover)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = 'transparent' }}>
                          <td style={{ padding:'10px 16px', width:32 }}>
                            <span style={{ fontSize:11, fontWeight:700, color:'var(--txt-3)' }}>{si + 1}.{qi + 1}</span>
                          </td>
                          <td style={{ padding:'10px 16px', fontSize:13, color:'var(--txt)', lineHeight:1.5 }}>{q.question}</td>
                          <td style={{ padding:'10px 16px', whiteSpace:'nowrap' }}>
                            <div style={{ display:'flex', gap:6 }}>
                              <button onClick={() => { setEditQ(q); setEditText(q.question) }} className="btn-outline" style={{ padding:'4px 10px', fontSize:11, borderRadius:6 }}>Editar</button>
                              <button onClick={() => setDelQ(q)} style={{ padding:'4px 10px', fontSize:11, borderRadius:6, cursor:'pointer', background:'var(--danger-dim)', border:'1px solid rgba(239,68,68,.3)', color:'#FCA5A5', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>Excluir</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Modal: Visualizar respostas */}
      {selected && (
        <Modal title={`Diagnóstico — ${selected.lead?.company}`} onClose={() => { setSelected(null); setRespData({}) }} wide>
          <div id="diag-print-area">
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }} className="no-print">
              <p style={{ fontSize:12, color:'var(--txt-2)' }}>{selected.lead?.name} · {selected.lead?.email}</p>
              <button onClick={() => window.print()} className="btn-outline" style={{ padding:'7px 16px', fontSize:12 }}>Baixar PDF</button>
            </div>
            <div className="print-only" style={{ display:'none', marginBottom:24 }}>
              <h1 style={{ fontSize:20, fontWeight:800 }}>Diagnóstico de Atendimento</h1>
              <p>{selected.lead?.company} · {selected.lead?.name}</p>
              <p style={{ fontSize:12 }}>Impresso em {new Date().toLocaleDateString('pt-BR')}</p><hr />
            </div>
            {respLoad ? (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:120, gap:10, color:'var(--txt-2)' }}>
                <span className="spinner" style={{ width:18, height:18 }} /><span style={{ fontSize:13 }}>Carregando respostas...</span>
              </div>
            ) : SECTION_LABELS.map((sLabel, si) => {
              const answers = Array.from({ length:4 }, (_, qi) => respData[`${si + 1}.${qi + 1}`])
              if (answers.every(a => !a)) return null
              return (
                <div key={si} style={{ marginBottom:20 }}>
                  <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.1em', color:'var(--neon)', marginBottom:8 }}>Seção {si + 1} · {sLabel}</div>
                  {answers.map((val, qi) => val ? (
                    <div key={qi} style={{ marginBottom:12, paddingLeft:12, borderLeft:'2px solid var(--border)' }}>
                      <div style={{ fontSize:12, fontWeight:600, color:'var(--txt-2)', marginBottom:4 }}>Pergunta {qi + 1}</div>
                      <div style={{ fontSize:13, color:'var(--txt)', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{val}</div>
                    </div>
                  ) : null)}
                </div>
              )
            })}
          </div>
        </Modal>
      )}

      {/* Modal: Editar pergunta */}
      {editQ && (
        <Modal title="Editar Pergunta" onClose={() => setEditQ(null)}>
          <div style={{ fontSize:11, color:'var(--txt-3)', marginBottom:12 }}>
            Seção {editQ.sectionIndex} · {editQ.sectionTitle}
          </div>
          <Field label="Texto da pergunta" value={editText} onChange={setEditText} multiline placeholder="Digite o texto da pergunta..." />
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => setEditQ(null)} className="btn-outline" style={{ flex:1, padding:'10px', fontSize:13 }}>Cancelar</button>
            <button onClick={saveEditQ} disabled={saving || !editText.trim()} className="btn-neon" style={{ flex:1, padding:'10px', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {saving ? <><span className="spinner" style={{ width:14, height:14 }} />Salvando...</> : 'Salvar alterações'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal: Adicionar pergunta */}
      {addModal && (
        <Modal title="Adicionar Pergunta" onClose={() => { setAddModal(false); setNewQText('') }}>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--txt-2)', marginBottom:5 }}>Seção</label>
            <select value={newSecIdx} onChange={e => setNewSecIdx(Number(e.target.value))} style={{ width:'100%', padding:'9px 12px', borderRadius:8, background:'var(--bg-input)', border:'1px solid var(--border-md)', color:'var(--txt)', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
              {sections.map((sec, i) => <option key={i} value={i + 1}>{i + 1}. {sec.title}</option>)}
            </select>
          </div>
          <Field label="Texto da pergunta" value={newQText} onChange={setNewQText} multiline placeholder="Digite o texto da nova pergunta..." />
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => { setAddModal(false); setNewQText('') }} className="btn-outline" style={{ flex:1, padding:'10px', fontSize:13 }}>Cancelar</button>
            <button onClick={addQuestion} disabled={saving || !newQText.trim()} className="btn-neon" style={{ flex:1, padding:'10px', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {saving ? <><span className="spinner" style={{ width:14, height:14 }} />Adicionando...</> : 'Adicionar'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal: Confirmar exclusão */}
      {delQ && (
        <Modal title="Excluir Pergunta" onClose={() => setDelQ(null)}>
          <p style={{ fontSize:13, color:'var(--txt-2)', lineHeight:1.6, marginBottom:20 }}>
            Tem certeza que deseja excluir a pergunta:<br />
            <strong style={{ color:'var(--txt)' }}>"{delQ.question}"</strong>
          </p>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => setDelQ(null)} className="btn-outline" style={{ flex:1, padding:'10px', fontSize:13 }}>Cancelar</button>
            <button onClick={deleteQuestion} disabled={saving} className="btn-danger" style={{ flex:1, padding:'10px', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {saving ? <><span className="spinner" style={{ width:14, height:14 }} />Excluindo...</> : 'Excluir'}
            </button>
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
