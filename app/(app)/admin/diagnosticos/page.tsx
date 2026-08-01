'use client'
import { useEffect, useState } from 'react'

const SECTIONS_LABELS = [
  'Escopo de Serviços','Diferenciação','Primeiro Contato','Processos','Identidade Visual',
  'Área e Capacidade','Regras da IA','Transição','Autonomia da IA','Pós-Venda','Tom de Voz','Visão de Futuro',
]

type Lead = { id: string; name: string; email: string; company: string }
type DiagItem = {
  id: string; leadId: string; token: string;
  status: 'pending' | 'answered'; responses: string;
  createdAt: string; respondedAt: string;
  lead?: Lead
}

export default function DiagnosticosPage() {
  const [items,    setItems]    = useState<DiagItem[]>([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState<DiagItem | null>(null)
  const [diagData, setDiagData] = useState<Record<string, string>>({})
  const [diagLoad, setDiagLoad] = useState(false)

  useEffect(() => { fetchAll() }, [])

  async function fetchAll() {
    setLoading(true)
    try {
      const dr = await fetch('/api/admin/leads-com-diagnostico').then(r => r.json())
      if (dr.success) {
        const diags: DiagItem[] = dr.data
          .filter((l: any) => l.diagnostico)
          .map((l: any) => ({
            ...l.diagnostico,
            lead: { id: l.id, name: l.name, email: l.email, company: l.company },
          }))
        setItems(diags.sort((a, b) => (a.status === 'answered' ? -1 : 1)))
      }
    } catch {}
    finally { setLoading(false) }
  }

  async function openDiag(item: DiagItem) {
    setSelected(item)
    setDiagData({})
    if (item.status !== 'answered') return
    setDiagLoad(true)
    try {
      const r = await fetch(`/api/admin/diagnostico/${item.id}`)
      const d = await r.json()
      if (d.success) {
        try { setDiagData(JSON.parse(d.data.responses)) } catch {}
      }
    } catch {}
    finally { setDiagLoad(false) }
  }

  const answered = items.filter(i => i.status === 'answered').length
  const pending  = items.filter(i => i.status === 'pending').length

  return (
    <div style={{ padding: '24px 20px', maxWidth: 900, margin: '0 auto' }}>

      {/* Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24, maxWidth: 400 }}>
        <div className="card" style={{ padding: '16px 18px', background: 'rgba(16,185,129,.08)', border: '1px solid rgba(16,185,129,.2)' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981', fontFamily: "'Syne',sans-serif" }}>{answered}</div>
          <div style={{ fontSize: 12, color: 'var(--txt-2)', marginTop: 2 }}>Respondidos</div>
        </div>
        <div className="card" style={{ padding: '16px 18px', background: 'rgba(245,158,11,.08)', border: '1px solid rgba(245,158,11,.2)' }}>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b', fontFamily: "'Syne',sans-serif" }}>{pending}</div>
          <div style={{ fontSize: 12, color: 'var(--txt-2)', marginTop: 2 }}>Pendentes</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Empresa', 'Responsável', 'Status', 'Respondido em', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--txt-3)', textAlign: 'left', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--txt-2)', fontSize: 13 }}>
                  <span className="spinner" style={{ width: 18, height: 18, display: 'inline-block', marginRight: 8, verticalAlign: 'middle' }} />Carregando...
                </td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={5} style={{ padding: 40, textAlign: 'center', color: 'var(--txt-3)', fontSize: 13 }}>Nenhum diagnóstico registrado ainda.</td></tr>
              ) : items.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '14px 16px', fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>{item.lead?.company ?? '—'}</td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: 12, color: 'var(--txt)' }}>{item.lead?.name ?? '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--txt-2)' }}>{item.lead?.email ?? ''}</div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: item.status === 'answered' ? 'rgba(16,185,129,.12)' : 'rgba(245,158,11,.1)',
                      color: item.status === 'answered' ? '#10b981' : '#f59e0b',
                    }}>
                      {item.status === 'answered' ? 'Respondido' : 'Pendente'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 12, color: 'var(--txt-2)' }}>
                    {item.respondedAt ? new Date(item.respondedAt).toLocaleDateString('pt-BR') : '—'}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {item.status === 'answered' && (
                      <button onClick={() => openDiag(item)} className="btn-outline" style={{ padding: '5px 12px', fontSize: 12 }}>
                        Visualizar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de visualização */}
      {selected && (
        <div className="modal-bg" onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div className="card animate-slide-up" style={{ width: 'min(720px, calc(100vw - 32px))', padding: '24px 22px', maxHeight: '90vh', overflowY: 'auto', position: 'relative' }}>
            <button onClick={() => setSelected(null)} style={{ position: 'absolute', top: 14, right: 14, width: 28, height: 28, borderRadius: 7, background: 'var(--bg-input)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--txt-2)', fontSize: 17, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>

            <div id="diag-print-area">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }} className="no-print">
                <div>
                  <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)', marginBottom: 4 }}>
                    Diagnóstico — {selected.lead?.company}
                  </h3>
                  <p style={{ fontSize: 12, color: 'var(--txt-2)' }}>{selected.lead?.name} · {selected.lead?.email}</p>
                </div>
                <button onClick={() => window.print()} className="btn-outline" style={{ padding: '7px 16px', fontSize: 12, flexShrink: 0 }}>
                  Baixar PDF
                </button>
              </div>

              <div className="print-only" style={{ display: 'none', marginBottom: 24 }}>
                <h1 style={{ fontSize: 20, fontWeight: 800 }}>Diagnóstico de Atendimento</h1>
                <p style={{ fontSize: 14 }}>{selected.lead?.company} · {selected.lead?.name}</p>
                <p style={{ fontSize: 12 }}>Impresso em {new Date().toLocaleDateString('pt-BR')}</p>
                <hr />
              </div>

              {diagLoad ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--txt-2)' }}>
                  <span className="spinner" style={{ width: 20, height: 20, display: 'block', margin: '0 auto 12px' }} />
                  Carregando respostas...
                </div>
              ) : (
                SECTIONS_LABELS.map((sLabel, si) => {
                  const answers = Array.from({ length: 4 }, (_, qi) => diagData[`${si + 1}.${qi + 1}`])
                  if (answers.every(a => !a)) return null
                  return (
                    <div key={si} style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--neon)', marginBottom: 8 }}>
                        Seção {si + 1} · {sLabel}
                      </div>
                      {answers.map((val, qi) => val ? (
                        <div key={qi} style={{ marginBottom: 12, paddingLeft: 12, borderLeft: '2px solid var(--border)' }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--txt-2)', marginBottom: 4 }}>Pergunta {qi + 1}</div>
                          <div style={{ fontSize: 13, color: 'var(--txt)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{val}</div>
                        </div>
                      ) : null)}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

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
