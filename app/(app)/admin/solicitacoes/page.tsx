'use client'
import { useEffect, useState, useRef } from 'react'

const SECTIONS_LABELS = [
  'Escopo de Serviços','Diferenciação','Primeiro Contato','Processos','Identidade Visual',
  'Área e Capacidade','Regras da IA','Transição','Autonomia da IA','Pós-Venda','Tom de Voz','Visão de Futuro',
]

type DiagInfo = {
  id: string
  token: string
  status: 'pending' | 'answered'
  respondedAt: string
} | null

type Lead = {
  id: string
  name: string
  email: string
  phone: string
  company: string
  planId: string
  planName: string
  status: 'new' | 'contacted' | 'converted' | 'lost'
  createdAt: string
  diagnostico: DiagInfo
}

type ModalType = 'detalhes' | 'diagnostico' | 'aprovar' | 'recusar' | null

const STATUS_LABEL: Record<Lead['status'], string> = {
  new:       'Novo',
  contacted: 'Contatado',
  converted: 'Aprovado',
  lost:      'Recusado',
}
const STATUS_COLOR: Record<Lead['status'], string> = {
  new:       'rgba(163,230,53,.15)',
  contacted: 'rgba(59,130,246,.15)',
  converted: 'rgba(16,185,129,.15)',
  lost:      'rgba(220,38,38,.12)',
}
const STATUS_TXT: Record<Lead['status'], string> = {
  new:       '#a3e635',
  contacted: '#60a5fa',
  converted: '#10b981',
  lost:      '#f87171',
}

export default function SolicitacoesPage() {
  const [leads,      setLeads]      = useState<Lead[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filter,     setFilter]     = useState<'all' | Lead['status']>('all')
  const [modal,      setModal]      = useState<ModalType>(null)
  const [selected,   setSelected]   = useState<Lead | null>(null)
  const [diagData,   setDiagData]   = useState<Record<string, string>>({})
  const [diagLoad,   setDiagLoad]   = useState(false)
  const [openDrop,   setOpenDrop]   = useState<string | null>(null)
  const [saving,     setSaving]     = useState(false)
  const [err,        setErr]        = useState('')

  // Detalhes/edição
  const [editName,    setEditName]    = useState('')
  const [editEmail,   setEditEmail]   = useState('')
  const [editPhone,   setEditPhone]   = useState('')
  const [editCompany, setEditCompany] = useState('')
  const [editPlan,    setEditPlan]    = useState('')

  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchLeads()
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpenDrop(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function fetchLeads() {
    setLoading(true)
    try {
      const r = await fetch('/api/admin/leads-com-diagnostico')
      const d = await r.json()
      if (d.success) setLeads(d.data as Lead[])
    } catch {}
    finally { setLoading(false) }
  }

  function openModal(type: ModalType, lead: Lead) {
    setSelected(lead)
    setModal(type)
    setErr('')
    setOpenDrop(null)
    if (type === 'detalhes') {
      setEditName(lead.name)
      setEditEmail(lead.email)
      setEditPhone(lead.phone)
      setEditCompany(lead.company)
      setEditPlan(lead.planName)
    }
    if (type === 'diagnostico' && lead.diagnostico?.status === 'answered') {
      loadDiag(lead.diagnostico.id)
    }
  }

  async function loadDiag(diagId: string) {
    setDiagLoad(true)
    try {
      const r = await fetch(`/api/admin/diagnostico/${diagId}`)
      const d = await r.json()
      if (d.success) {
        try { setDiagData(JSON.parse(d.data.responses)) } catch {}
      }
    } catch {}
    finally { setDiagLoad(false) }
  }

  async function saveDetalhes() {
    if (!selected) return
    setSaving(true); setErr('')
    try {
      const r = await fetch(`/api/admin/leads/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, email: editEmail, phone: editPhone, company: editCompany, planName: editPlan }),
      })
      const d = await r.json()
      if (!d.success) { setErr(d.error ?? 'Erro ao salvar'); return }
      setModal(null)
      fetchLeads()
    } catch { setErr('Erro de conexão') }
    finally { setSaving(false) }
  }

  async function changeStatus(lead: Lead, status: Lead['status']) {
    setSaving(true); setErr('')
    try {
      const r = await fetch(`/api/admin/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const d = await r.json()
      if (!d.success) { setErr(d.error ?? 'Erro'); return }
      setModal(null)
      fetchLeads()
    } catch { setErr('Erro de conexão') }
    finally { setSaving(false) }
  }

  function printDiag() { window.print() }

  const filtered = filter === 'all' ? leads : leads.filter(l => l.status === filter)
  const counts   = {
    new:       leads.filter(l => l.status === 'new').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    converted: leads.filter(l => l.status === 'converted').length,
    lost:      leads.filter(l => l.status === 'lost').length,
  }

  const inputSt: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid var(--border-md)', background: 'var(--bg-input)',
    color: 'var(--txt)', fontSize: 13, boxSizing: 'border-box',
    fontFamily: "'Plus Jakarta Sans',sans-serif",
  }
  const labelSt: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700,
    color: 'var(--txt-2)', marginBottom: 5,
    textTransform: 'uppercase', letterSpacing: '.07em',
  }

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Cards de resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 12, marginBottom: 24 }}>
        {([
          ['Novos',       counts.new,       '#a3e635', 'rgba(163,230,53,.1)'],
          ['Contatados',  counts.contacted,  '#60a5fa', 'rgba(59,130,246,.08)'],
          ['Aprovados',   counts.converted, '#10b981', 'rgba(16,185,129,.08)'],
          ['Recusados',   counts.lost,      '#f87171', 'rgba(220,38,38,.08)'],
        ] as const).map(([label, count, color, bg]) => (
          <div key={label} className="card" style={{ padding: '16px 18px', background: bg, border: `1px solid ${color}22` }}>
            <div style={{ fontSize: 24, fontWeight: 700, color, fontFamily: "'Syne',sans-serif" }}>{count}</div>
            <div style={{ fontSize: 12, color: 'var(--txt-2)', marginTop: 2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['all', 'new', 'contacted', 'converted', 'lost'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            border: `1px solid ${filter === f ? 'var(--neon-border)' : 'var(--border)'}`,
            background: filter === f ? 'var(--neon-dim)' : 'transparent',
            color: filter === f ? 'var(--neon)' : 'var(--txt-2)',
          }}>
            {f === 'all' ? 'Todos' : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Empresa / Gestor', 'E-mail / Telefone', 'Diagnóstico', 'Plano', 'Status', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--txt-3)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--txt-2)', fontSize: 13 }}>
                  <span className="spinner" style={{ width: 18, height: 18, display: 'inline-block', marginRight: 8, verticalAlign: 'middle' }} />
                  Carregando...
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--txt-3)', fontSize: 13 }}>Nenhuma solicitação encontrada.</td></tr>
              ) : filtered.map(lead => {
                const diag = lead.diagnostico
                return (
                  <tr key={lead.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background .1s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--nav-active-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                    {/* Empresa / Gestor */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>{lead.company}</div>
                      <div style={{ fontSize: 11, color: 'var(--txt-2)', marginTop: 2 }}>{lead.name}</div>
                    </td>

                    {/* E-mail / Telefone */}
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: 12, color: 'var(--txt)' }}>{lead.email}</div>
                      <div style={{ fontSize: 11, color: 'var(--txt-2)', marginTop: 2 }}>{lead.phone}</div>
                    </td>

                    {/* Diagnóstico */}
                    <td style={{ padding: '14px 16px' }}>
                      {!diag ? (
                        <span style={{ fontSize: 11, color: 'var(--txt-3)' }}>—</span>
                      ) : diag.status === 'answered' ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(16,185,129,.12)', color: '#10b981' }}>
                            Respondido
                          </span>
                          <button
                            onClick={() => openModal('diagnostico', lead)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--txt-3)', fontSize: 16, padding: '0 4px', lineHeight: 1 }}
                            title="Ver diagnóstico">
                            ···
                          </button>
                        </div>
                      ) : (
                        <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(245,158,11,.1)', color: '#f59e0b' }}>
                          Pendente
                        </span>
                      )}
                    </td>

                    {/* Plano */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontSize: 12, color: 'var(--txt)' }}>{lead.planName}</span>
                    </td>

                    {/* Status */}
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: STATUS_COLOR[lead.status], color: STATUS_TXT[lead.status] }}>
                        {STATUS_LABEL[lead.status]}
                      </span>
                    </td>

                    {/* Ações */}
                    <td style={{ padding: '14px 16px' }} ref={openDrop === lead.id ? dropRef : undefined}>
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={() => setOpenDrop(openDrop === lead.id ? null : lead.id)}
                          style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: '1px solid var(--border-md)', background: 'var(--bg-input)', color: 'var(--txt)', cursor: 'pointer' }}>
                          Opções ▾
                        </button>
                        {openDrop === lead.id && (
                          <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '4px 0', zIndex: 50, minWidth: 160, boxShadow: '0 8px 24px rgba(0,0,0,.3)' }}>
                            <DropItem label="Detalhes / Editar" onClick={() => openModal('detalhes', lead)} />
                            {lead.diagnostico?.status === 'answered' && (
                              <DropItem label="Ver Diagnóstico" onClick={() => openModal('diagnostico', lead)} />
                            )}
                            {lead.status !== 'converted' && (
                              <DropItem label="Aprovar" color="#10b981" onClick={() => openModal('aprovar', lead)} />
                            )}
                            {lead.status !== 'lost' && (
                              <DropItem label="Recusar" color="#f87171" onClick={() => openModal('recusar', lead)} />
                            )}
                          </div>
                        )}
                      </div>
                    </td>

                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal: Detalhes / Editar ──────────────────────────────── */}
      {modal === 'detalhes' && selected && (
        <ModalBg onClose={() => setModal(null)}>
          <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)', marginBottom: 20 }}>Detalhes / Editar — {selected.company}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><label style={labelSt}>Nome</label><input value={editName} onChange={e => setEditName(e.target.value)} style={inputSt} /></div>
              <div><label style={labelSt}>Empresa</label><input value={editCompany} onChange={e => setEditCompany(e.target.value)} style={inputSt} /></div>
              <div><label style={labelSt}>E-mail</label><input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} style={inputSt} /></div>
              <div><label style={labelSt}>Telefone</label><input value={editPhone} onChange={e => setEditPhone(e.target.value)} style={inputSt} /></div>
              <div style={{ gridColumn: '1/-1' }}><label style={labelSt}>Plano</label><input value={editPlan} onChange={e => setEditPlan(e.target.value)} style={inputSt} /></div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--txt-3)' }}>
              Cadastrado em: {new Date(selected.createdAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
            </div>
            {err && <p style={{ fontSize: 12, color: 'var(--danger)' }}>{err}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} className="btn-outline" style={{ padding: '9px 18px', fontSize: 13 }}>Cancelar</button>
              <button onClick={saveDetalhes} disabled={saving} className="btn-neon" style={{ padding: '9px 18px', fontSize: 13, fontWeight: 700 }}>
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </ModalBg>
      )}

      {/* ── Modal: Visualizar Diagnóstico ─────────────────────────── */}
      {modal === 'diagnostico' && selected && (
        <ModalBg onClose={() => { setModal(null); setDiagData({}) }} wide>
          <div id="diag-print-area">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }} className="no-print">
              <div>
                <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)', marginBottom: 4 }}>Diagnóstico — {selected.company}</h3>
                <p style={{ fontSize: 12, color: 'var(--txt-2)' }}>{selected.name} · {selected.email}</p>
              </div>
              <button onClick={printDiag} className="btn-outline" style={{ padding: '7px 16px', fontSize: 12, flexShrink: 0 }}>
                Baixar PDF
              </button>
            </div>

            {/* Cabeçalho de impressão */}
            <div className="print-only" style={{ display: 'none', marginBottom: 24 }}>
              <h1 style={{ fontSize: 20, fontWeight: 800 }}>Diagnóstico de Atendimento</h1>
              <p style={{ fontSize: 14 }}>{selected.company} · {selected.name}</p>
              <p style={{ fontSize: 12, color: '#666' }}>Impresso em {new Date().toLocaleDateString('pt-BR')}</p>
              <hr />
            </div>

            {diagLoad ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'var(--txt-2)' }}>
                <span className="spinner" style={{ width: 20, height: 20, display: 'block', margin: '0 auto 12px' }} />
                Carregando respostas...
              </div>
            ) : (
              SECTIONS_LABELS.map((sLabel, si) => {
                const hasAnswers = Array.from({ length: 4 }, (_, qi) => diagData[`${si + 1}.${qi + 1}`]).some(Boolean)
                if (!hasAnswers) return null
                return (
                  <div key={si} style={{ marginBottom: 20, pageBreakInside: 'avoid' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--neon)', marginBottom: 8 }}>
                      Seção {si + 1} · {sLabel}
                    </div>
                    {Array.from({ length: 4 }, (_, qi) => {
                      const val = diagData[`${si + 1}.${qi + 1}`]
                      if (!val) return null
                      return (
                        <div key={qi} style={{ marginBottom: 12, paddingLeft: 12, borderLeft: '2px solid var(--border)' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt-2)', marginBottom: 4 }}>Pergunta {qi + 1}</div>
                          <div style={{ fontSize: 13, color: 'var(--txt)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{val}</div>
                        </div>
                      )
                    })}
                  </div>
                )
              })
            )}
          </div>
        </ModalBg>
      )}

      {/* ── Modal: Aprovar ──────────────────────────────────────── */}
      {modal === 'aprovar' && selected && (
        <ModalBg onClose={() => setModal(null)}>
          <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)', marginBottom: 12 }}>Aprovar solicitação</h3>
          <p style={{ fontSize: 13, color: 'var(--txt-2)', lineHeight: 1.6, marginBottom: 20 }}>
            Confirmar aprovação de <strong style={{ color: 'var(--txt)' }}>{selected.company}</strong>? O status será atualizado para <strong style={{ color: '#10b981' }}>Aprovado</strong>.
          </p>
          {err && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>{err}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setModal(null)} className="btn-outline" style={{ padding: '9px 18px', fontSize: 13 }}>Cancelar</button>
            <button onClick={() => changeStatus(selected, 'converted')} disabled={saving} className="btn-primary" style={{ padding: '9px 18px', fontSize: 13, fontWeight: 700, background: '#10b981', borderColor: '#059669' }}>
              {saving ? 'Aprovando...' : 'Confirmar Aprovação'}
            </button>
          </div>
        </ModalBg>
      )}

      {/* ── Modal: Recusar ──────────────────────────────────────── */}
      {modal === 'recusar' && selected && (
        <ModalBg onClose={() => setModal(null)}>
          <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)', marginBottom: 12 }}>Recusar solicitação</h3>
          <p style={{ fontSize: 13, color: 'var(--txt-2)', lineHeight: 1.6, marginBottom: 20 }}>
            Confirmar recusa de <strong style={{ color: 'var(--txt)' }}>{selected.company}</strong>? O status será atualizado para <strong style={{ color: '#f87171' }}>Recusado</strong>.
          </p>
          {err && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 12 }}>{err}</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={() => setModal(null)} className="btn-outline" style={{ padding: '9px 18px', fontSize: 13 }}>Cancelar</button>
            <button onClick={() => changeStatus(selected, 'lost')} disabled={saving} className="btn-danger" style={{ padding: '9px 18px', fontSize: 13, fontWeight: 700 }}>
              {saving ? 'Recusando...' : 'Confirmar Recusa'}
            </button>
          </div>
        </ModalBg>
      )}

      {/* CSS de impressão */}
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

function DropItem({ label, onClick, color }: { label: string; onClick: () => void; color?: string }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 14px', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', color: color ?? 'var(--txt)', fontFamily: "'Plus Jakarta Sans',sans-serif", whiteSpace: 'nowrap' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--nav-active-bg)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
      {label}
    </button>
  )
}

function ModalBg({ children, onClose, wide }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="card animate-slide-up" style={{ width: wide ? 'min(700px, calc(100vw - 32px))' : 'min(480px, calc(100vw - 32px))', padding: '24px 22px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, width: 28, height: 28, borderRadius: 7, background: 'var(--bg-input)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--txt-2)', fontSize: 17, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
        {children}
      </div>
    </div>
  )
}
