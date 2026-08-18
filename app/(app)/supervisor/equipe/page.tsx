'use client'
// app/(app)/supervisor/equipe/page.tsx
import { useEffect, useState } from 'react'
import { IcoUsers } from '@/components/icons'

interface Attendant {
  id: string; name: string; email: string; phone: string; role: string
  canViewDashboard: boolean; canViewCRM: boolean
  canViewTranscricoes: boolean; canViewSatisfacao: boolean
  canViewAgendamentos: boolean
  createdAt: string; isActive: boolean
}

const ROLE_LBL: Record<string, string> = { atendente: 'Atendente', supervisor: 'Supervisor', master: 'Master' }

function fmtDate(iso: string) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('pt-BR') } catch { return iso }
}

export default function EquipePage() {
  const [team,    setTeam]    = useState<Attendant[]>([])
  const [loading, setLoading] = useState(true)
  const [toast,   setToast]   = useState('')
  const [showNew, setShowNew] = useState(false)
  const [form,    setForm]    = useState({ name: '', email: '', phone: '', password: '' })
  const [saving,  setSaving]  = useState(false)
  const [toggleOf, setToggleOf] = useState<Attendant | null>(null)
  const [tog, setTog] = useState({ canViewDashboard: false, canViewCRM: false, canViewTranscricoes: false, canViewSatisfacao: false, canViewAgendamentos: false })

  function F(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }
  function showToast(m: string) { setToast(m); setTimeout(() => setToast(''), 3500) }

  async function load() {
    setLoading(true)
    const r = await fetch('/api/team')
    const d = await r.json()
    if (d.success) setTeam(d.data)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function saveNew(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const r = await fetch('/api/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const d = await r.json(); setSaving(false)
    if (d.success) { setShowNew(false); setForm({ name: '', email: '', phone: '', password: '' }); load(); showToast('✓ Atendente criado!') }
    else showToast(`Erro: ${d.error}`)
  }

  async function saveToggles() {
    if (!toggleOf) return
    await fetch('/api/team', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: toggleOf.id, ...tog }) })
    setToggleOf(null); load(); showToast('✓ Permissões atualizadas')
  }

  async function deactivate(id: string, name: string) {
    if (!confirm(`Desativar ${name}?`)) return
    await fetch(`/api/team?userId=${id}`, { method: 'DELETE' })
    load(); showToast('✓ Atendente desativado')
  }

  const th = { padding: '10px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '.07em', color: 'var(--txt-3)', textAlign: 'left' as const, background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }
  const td = { padding: '12px 16px', fontSize: 13, color: 'var(--txt-2)', verticalAlign: 'middle' as const }

  function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
    return (
      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
        <span style={{ fontSize: 13, color: 'var(--txt)' }}>{label}</span>
        <div className={`ia-toggle ${value ? 'ia-toggle-on' : 'ia-toggle-off'}`} onClick={() => onChange(!value)} />
      </label>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, background: 'var(--bg-card)', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div className="font-display" style={{ fontSize: 16, fontWeight: 700, color: 'var(--txt)' }}>Equipe</div>
          <div style={{ fontSize: 11, color: 'var(--txt-2)', marginTop: 2 }}>{team.length} atendentes cadastrados</div>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-neon" style={{ padding: '9px 16px', fontSize: 13 }}>+ Novo Atendente</button>
        <button onClick={load} style={{ padding: '8px 12px', borderRadius: 8, fontSize: 14, cursor: 'pointer', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--txt-2)', fontFamily: "'Plus Jakarta Sans',sans-serif", marginLeft: 'auto' }}>↻</button>
      </div>

      {/* Tabela */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10, color: 'var(--txt-2)' }}>
            <span className="spinner" style={{ width: 18, height: 18 }} /><span style={{ fontSize: 13 }}>Carregando...</span>
          </div>
        ) : team.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8 }}>
            <IcoUsers size={32}/>
            <p style={{ fontSize: 13, color: 'var(--txt-2)' }}>Nenhum atendente cadastrado</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Nome', 'E-mail', 'Cargo', 'Criado em', 'Ações'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {team.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}>
                  <td style={td}><div style={{ fontWeight: 500, color: 'var(--txt)' }}>{u.name}</div><div style={{ fontSize: 11, color: 'var(--txt-3)' }}>{u.phone || ''}</div></td>
                  <td style={td}>{u.email}</td>
                  <td style={td}><span style={{ fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 100, background: 'var(--neon-dim)', color: 'var(--neon)' }}>{ROLE_LBL[u.role] ?? u.role}</span></td>
                  <td style={{ ...td, fontSize: 12 }}>{fmtDate(u.createdAt)}</td>
                  <td style={td}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => { setToggleOf(u); setTog({ canViewDashboard: u.canViewDashboard, canViewCRM: u.canViewCRM, canViewTranscricoes: u.canViewTranscricoes, canViewSatisfacao: u.canViewSatisfacao, canViewAgendamentos: u.canViewAgendamentos }) }}
                        className="btn-outline" style={{ padding: '5px 10px', fontSize: 11, borderRadius: 6 }}>Permissões</button>
                      <button onClick={() => deactivate(u.id, u.name)}
                        style={{ padding: '5px 10px', fontSize: 11, borderRadius: 6, cursor: 'pointer', background: 'var(--danger-dim)', border: '1px solid rgba(239,68,68,.25)', color: '#FCA5A5', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>Desativar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal novo atendente */}
      {showNew && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setShowNew(false) }}>
          <div className="card animate-slide-up" style={{ maxWidth: 420, width: '100%', padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--txt)' }}>Novo Atendente</h2>
              <button onClick={() => setShowNew(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--txt-2)', lineHeight: 1 }}>×</button>
            </div>
            <form onSubmit={saveNew} style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[['Nome completo', 'name', 'text', 'Maria Silva'], ['E-mail', 'email', 'email', 'maria@empresa.com'], ['Telefone', 'phone', 'text', '5571999999999'], ['Senha inicial', 'password', 'password', 'mínimo 8 caracteres']].map(([label, key, type, ph]) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--txt-2)', marginBottom: 5 }}>{label}</label>
                  <input type={type} value={(form as Record<string, string>)[key]} onChange={e => F(key, e.target.value)} placeholder={ph} required={key !== 'phone'} style={{ width: '100%', padding: '9px 12px' }} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setShowNew(false)} className="btn-outline" style={{ flex: 1, padding: '10px', fontSize: 13 }}>Cancelar</button>
                <button type="submit" disabled={saving} className="btn-neon" style={{ flex: 1, padding: '10px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {saving ? <><span className="spinner" style={{ width: 14, height: 14 }} />Criando...</> : 'Criar Atendente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal permissões */}
      {toggleOf && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setToggleOf(null) }}>
          <div className="card animate-slide-up" style={{ maxWidth: 360, width: '100%', padding: 0 }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 className="font-display" style={{ fontSize: 15, fontWeight: 700, color: 'var(--txt)' }}>Permissões — {toggleOf.name}</h2>
              <button onClick={() => setToggleOf(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--txt-2)', lineHeight: 1 }}>×</button>
            </div>
            <div style={{ padding: 20 }}>
              <Toggle label="Dashboard" value={tog.canViewDashboard} onChange={v => setTog(t => ({ ...t, canViewDashboard: v }))} />
              <Toggle label="CRM / Clientes" value={tog.canViewCRM} onChange={v => setTog(t => ({ ...t, canViewCRM: v }))} />
              <Toggle label="Transcrições" value={tog.canViewTranscricoes} onChange={v => setTog(t => ({ ...t, canViewTranscricoes: v }))} />
              <Toggle label="Satisfação"    value={tog.canViewSatisfacao}    onChange={v => setTog(t => ({ ...t, canViewSatisfacao: v }))} />
              <Toggle label="Agendamentos" value={tog.canViewAgendamentos} onChange={v => setTog(t => ({ ...t, canViewAgendamentos: v }))} />
              <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                <button onClick={() => setToggleOf(null)} className="btn-outline" style={{ flex: 1, padding: '10px', fontSize: 13 }}>Cancelar</button>
                <button onClick={saveToggles} className="btn-neon" style={{ flex: 1, padding: '10px', fontSize: 13 }}>Salvar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast-base">{toast}</div>}
    </div>
  )
}
