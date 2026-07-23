'use client'
// ─────────────────────────────────────────────────────────────
// app/(app)/crm/page.tsx
// FASE 4 — CRM inteligente com funil, tags, follow-up e
// disparo de mensagens em lote.
// ─────────────────────────────────────────────────────────────

import { useEffect, useState, useMemo } from 'react'
import type { ClientRecord, CRMStage } from '@/types'
import { IcoPlusCircle, IcoMessageCircle, IcoClipboard, IcoClock, IcoLink, IcoCheckCircle, IcoXCircle, IcoUsers, IcoFileText } from '@/components/icons'

// ── Configuração do Funil ────────────────────────────────────

const STAGES: { key: CRMStage; label: string; color: string; icon: React.ReactNode }[] = [
  { key: 'novo',                label: 'Novo',                color: '#60A5FA', icon: <IcoPlusCircle size={13}/> },
  { key: 'em_atendimento',      label: 'Em Atendimento',      color: '#A78BFA', icon: <IcoMessageCircle size={13}/> },
  { key: 'proposta_enviada',    label: 'Proposta Enviada',    color: '#F59E0B', icon: <IcoClipboard size={13}/> },
  { key: 'aguardando_resposta', label: 'Aguardando Resposta', color: '#FB923C', icon: <IcoClock size={13}/> },
  { key: 'negociacao',          label: 'Negociação',          color: '#38BDF8', icon: <IcoLink size={13}/> },
  { key: 'fechado',             label: 'Fechado',             color: '#10B981', icon: <IcoCheckCircle size={13}/> },
  { key: 'perdido',             label: 'Perdido',             color: '#EF4444', icon: <IcoXCircle size={13}/> },
]

function stageInfo(key: string) {
  return STAGES.find(s => s.key === key) ?? STAGES[0]
}

function ini(n: string) { return n.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase() || '?' }

function fmtPhone(p: string) {
  const d = p.replace(/\D/g, '')
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`
  return p
}

function fmtDate(iso?: string) {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }) }
  catch { return iso }
}

function daysAgo(iso?: string) {
  if (!iso) return null
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (diff === 0) return 'Hoje'
  if (diff === 1) return 'Ontem'
  return `${diff}d atrás`
}

function isOverdue(iso?: string) {
  if (!iso) return false
  return new Date(iso) < new Date()
}

const AVATAR_COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EF4444', '#06B6D4']

// ── Componente Principal ─────────────────────────────────────

export default function CRMPage() {
  const [clients, setClients]     = useState<ClientRecord[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')
  const [search, setSearch]       = useState('')
  const [stageFilter, setStageFilter] = useState<string>('todos')
  const [tagFilter, setTagFilter] = useState('')
  const [view, setView]           = useState<'table' | 'funnel'>('table')
  const [selected, setSelected]   = useState<ClientRecord | null>(null)
  const [editMode, setEditMode]   = useState(false)
  const [toast, setToast]         = useState('')
  const [saving, setSaving]       = useState(false)
  // Disparo em lote
  const [bulkMode, setBulkMode]     = useState(false)
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set())
  const [bulkMessage, setBulkMessage]   = useState('')
  const [bulkSending, setBulkSending]   = useState(false)
  // Edição
  const [editEtapa, setEditEtapa]       = useState<CRMStage>('novo')
  const [editTags, setEditTags]         = useState('')
  const [editFollowUp, setEditFollowUp] = useState('')
  const [editValor, setEditValor]       = useState('')
  const [editNotas, setEditNotas]       = useState('')

  function showToast(m: string) { setToast(m); setTimeout(() => setToast(''), 3500) }

  // ── Carregar clientes ──────────────────────────────────────

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/crm', { cache: 'no-store' })
      const d = await r.json()
      if (d.success) setClients(Array.isArray(d.data) ? d.data : [])
      else setError(d.error)
    } catch { setError('Erro ao carregar') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  // ── Filtros ────────────────────────────────────────────────

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    clients.forEach(c => {
      if (c.tags) c.tags.split(',').forEach(t => { if (t.trim()) tags.add(t.trim()) })
    })
    return Array.from(tags).sort()
  }, [clients])

  const filtered = useMemo(() => clients.filter(c => {
    const ms = !search || c.nome.toLowerCase().includes(search.toLowerCase()) || c.telefone.includes(search)
    const mf = stageFilter === 'todos' || c.etapa === stageFilter
    const mt = !tagFilter || (c.tags && c.tags.toLowerCase().includes(tagFilter.toLowerCase()))
    return ms && mf && mt
  }), [clients, search, stageFilter, tagFilter])

  const overdueCount = useMemo(() =>
    clients.filter(c => isOverdue(c.proximoFollowUp) && c.etapa !== 'fechado' && c.etapa !== 'perdido').length
  , [clients])

  // ── Métricas do funil ──────────────────────────────────────

  const funnelData = useMemo(() => {
    const counts: Record<string, number> = {}
    STAGES.forEach(s => { counts[s.key] = 0 })
    clients.forEach(c => {
      const e = c.etapa || 'novo'
      counts[e] = (counts[e] ?? 0) + 1
    })
    return STAGES.map(s => ({ ...s, count: counts[s.key] }))
  }, [clients])

  // ── Selecionar cliente para edição ─────────────────────────

  function openDetail(c: ClientRecord) {
    setSelected(c)
    setEditMode(false)
    setEditEtapa((c.etapa as CRMStage) || 'novo')
    setEditTags(c.tags || '')
    setEditFollowUp(c.proximoFollowUp ? c.proximoFollowUp.slice(0, 10) : '')
    setEditValor(c.valorEstimado || '')
    setEditNotas(c.notas || '')
  }

  // ── Salvar edição ──────────────────────────────────────────

  async function saveClient() {
    if (!selected) return
    setSaving(true)
    try {
      const r = await fetch('/api/crm', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefone: selected.telefone,
          etapa: editEtapa,
          tags: editTags,
          proximoFollowUp: editFollowUp ? new Date(editFollowUp).toISOString() : '',
          valorEstimado: editValor,
          notas: editNotas,
        }),
      })
      const d = await r.json()
      if (d.success) {
        showToast('✓ Cliente atualizado')
        setEditMode(false)
        load() // Recarrega
      } else showToast('Erro: ' + d.error)
    } catch { showToast('Erro ao salvar') }
    finally { setSaving(false) }
  }

  // ── Toggle seleção em lote ─────────────────────────────────

  function toggleBulk(telefone: string) {
    setBulkSelected(prev => {
      const next = new Set(prev)
      if (next.has(telefone)) next.delete(telefone)
      else next.add(telefone)
      return next
    })
  }

  function selectAllFiltered() {
    if (bulkSelected.size === filtered.length) {
      setBulkSelected(new Set())
    } else {
      setBulkSelected(new Set(filtered.map(c => c.telefone)))
    }
  }

  // ── Disparo em lote ────────────────────────────────────────

  async function sendBulk() {
    if (!bulkMessage.trim() || bulkSelected.size === 0) return
    setBulkSending(true)
    try {
      const r = await fetch('/api/crm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefones: Array.from(bulkSelected),
          mensagem: bulkMessage.trim(),
        }),
      })
      const d = await r.json()
      if (d.success) {
        showToast(`✓ ${d.data.enviados} mensagens enviadas`)
        setBulkMode(false)
        setBulkSelected(new Set())
        setBulkMessage('')
      } else showToast('Erro: ' + d.error)
    } catch { showToast('Erro ao enviar') }
    finally { setBulkSending(false) }
  }

  // ── Render ─────────────────────────────────────────────────

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: 'var(--txt-2)' }}><span className="spinner" style={{ width: 18, height: 18 }} /><span style={{ fontSize: 13 }}>Carregando CRM...</span></div>
  if (error) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 10 }}><p style={{ color: 'var(--danger)', fontSize: 14 }}>{error}</p><button className="btn-outline" onClick={load} style={{ padding: '8px 16px', fontSize: 13 }}>Tentar novamente</button></div>

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Toolbar ───────────────────────────────────────── */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: 'var(--bg-card)', flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 150 }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontSize: 16, fontWeight: 700, color: 'var(--txt)' }}>CRM Inteligente</div>
            <div style={{ fontSize: 11, color: 'var(--txt-2)', display: 'flex', gap: 12, marginTop: 2 }}>
              <span>{clients.length} clientes</span>
              {overdueCount > 0 && <span style={{ color: '#EF4444', fontWeight: 600 }}>⚠ {overdueCount} follow-ups atrasados</span>}
            </div>
          </div>

          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, width: 180 }} />

          <select value={stageFilter} onChange={e => setStageFilter(e.target.value)} style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, width: 170 }}>
            <option value="todos">Todas as etapas</option>
            {STAGES.map(s => <option key={s.key} value={s.key}>{s.icon} {s.label}</option>)}
          </select>

          {allTags.length > 0 && (
            <select value={tagFilter} onChange={e => setTagFilter(e.target.value)} style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, width: 140 }}>
              <option value="">Todas as tags</option>
              {allTags.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}

          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setView('table')} style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: view === 'table' ? 'var(--neon-dim)' : 'var(--bg-input)', border: `1px solid ${view === 'table' ? 'var(--neon-border)' : 'var(--border)'}`, color: view === 'table' ? 'var(--neon)' : 'var(--txt-2)' }}>Lista</button>
            <button onClick={() => setView('funnel')} style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: view === 'funnel' ? 'var(--neon-dim)' : 'var(--bg-input)', border: `1px solid ${view === 'funnel' ? 'var(--neon-border)' : 'var(--border)'}`, color: view === 'funnel' ? 'var(--neon)' : 'var(--txt-2)' }}>Funil</button>
          </div>

          <button onClick={() => { setBulkMode(!bulkMode); setBulkSelected(new Set()) }} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: bulkMode ? 'var(--neon)' : 'var(--bg-input)', border: `1px solid ${bulkMode ? 'var(--neon)' : 'var(--border)'}`, color: bulkMode ? '#0a0a0a' : 'var(--txt-2)' }}>
            {bulkMode ? '✕ Cancelar' : '📨 Follow-up em lote'}
          </button>

          <button onClick={load} style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--txt-2)' }}>↻</button>
        </div>

        {/* ── Funil Visual ──────────────────────────────────── */}
        {view === 'funnel' && (
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, overflowX: 'auto', flexShrink: 0 }}>
            {funnelData.map(stage => (
              <button key={stage.key} onClick={() => setStageFilter(stage.key === stageFilter ? 'todos' : stage.key)}
                style={{
                  flex: 1, minWidth: 110, padding: '12px 10px', borderRadius: 10, cursor: 'pointer', textAlign: 'center',
                  background: stageFilter === stage.key ? `${stage.color}18` : 'var(--bg-input)',
                  border: `1px solid ${stageFilter === stage.key ? `${stage.color}40` : 'var(--border)'}`,
                  color: 'var(--txt)',
                }}>
                <div style={{ fontSize: 20 }}>{stage.icon}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: stage.color, marginTop: 4 }}>{stage.count}</div>
                <div style={{ fontSize: 10, color: 'var(--txt-2)', marginTop: 2 }}>{stage.label}</div>
              </button>
            ))}
          </div>
        )}

        {/* ── Barra de seleção em lote ──────────────────────── */}
        {bulkMode && (
          <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(163,230,53,0.05)', flexShrink: 0 }}>
            <button onClick={selectAllFiltered} style={{ padding: '5px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--txt-2)' }}>
              {bulkSelected.size === filtered.length ? 'Desmarcar todos' : 'Selecionar todos'}
            </button>
            <span style={{ fontSize: 12, color: 'var(--neon)', fontWeight: 600 }}>{bulkSelected.size} selecionados</span>
            <div style={{ flex: 1 }} />
            <input value={bulkMessage} onChange={e => setBulkMessage(e.target.value)} placeholder="Mensagem para enviar em lote..." style={{ flex: 2, padding: '7px 12px', borderRadius: 8, fontSize: 12 }} />
            <button onClick={sendBulk} disabled={bulkSending || !bulkMessage.trim() || bulkSelected.size === 0}
              style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--neon)', border: 'none', color: '#0a0a0a', opacity: (bulkSending || !bulkMessage.trim() || bulkSelected.size === 0) ? 0.4 : 1 }}>
              {bulkSending ? 'Enviando...' : `Enviar para ${bulkSelected.size}`}
            </button>
          </div>
        )}

        {/* ── Tabela ────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 200, gap: 8, color: 'var(--txt-3)' }}>
              <IcoUsers size={32}/><p style={{ fontSize: 13 }}>Nenhum cliente encontrado</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {bulkMode && <th style={thStyle}>
                    <input type="checkbox" checked={bulkSelected.size === filtered.length && filtered.length > 0} onChange={selectAllFiltered} />
                  </th>}
                  {['Cliente', 'Etapa', 'Tags', 'Último Contato', 'Follow-up', 'Valor'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const stage = stageInfo(c.etapa || 'novo')
                  const active = selected?.telefone === c.telefone
                  const overdue = isOverdue(c.proximoFollowUp) && c.etapa !== 'fechado' && c.etapa !== 'perdido'
                  const tags = c.tags ? c.tags.split(',').map(t => t.trim()).filter(Boolean) : []

                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', background: active ? 'var(--neon-dim)' : 'transparent', transition: 'background .12s' }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--bg-hover)' }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                      onClick={() => openDetail(c)}>

                      {bulkMode && <td style={tdStyle} onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={bulkSelected.has(c.telefone)} onChange={() => toggleBulk(c.telefone)} />
                      </td>}

                      <td style={tdStyle}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: AVATAR_COLORS[i % AVATAR_COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{ini(c.nome)}</div>
                          <div>
                            <div style={{ fontWeight: 500, color: 'var(--txt)', fontSize: 13 }}>{c.nome || '—'}</div>
                            <div style={{ fontSize: 10, color: 'var(--txt-3)', fontFamily: 'monospace' }}>{fmtPhone(c.telefone)}</div>
                          </div>
                        </div>
                      </td>

                      <td style={tdStyle}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 100, background: `${stage.color}15`, border: `1px solid ${stage.color}30`, color: stage.color }}>
                          {stage.icon} {stage.label}
                        </span>
                      </td>

                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {tags.length > 0 ? tags.slice(0, 3).map(t => (
                            <span key={t} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 100, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--txt-2)' }}>{t}</span>
                          )) : <span style={{ color: 'var(--txt-3)', fontSize: 11 }}>—</span>}
                          {tags.length > 3 && <span style={{ fontSize: 10, color: 'var(--txt-3)' }}>+{tags.length - 3}</span>}
                        </div>
                      </td>

                      <td style={{ ...tdStyle, fontSize: 12 }}>
                        {c.ultimoContato ? (
                          <span style={{ color: 'var(--txt-2)' }}>{daysAgo(c.ultimoContato)}</span>
                        ) : <span style={{ color: 'var(--txt-3)' }}>—</span>}
                      </td>

                      <td style={tdStyle}>
                        {c.proximoFollowUp ? (
                          <span style={{ fontSize: 11, fontWeight: 600, color: overdue ? '#EF4444' : 'var(--neon)' }}>
                            {overdue ? '⚠ ' : ''}{fmtDate(c.proximoFollowUp)}
                          </span>
                        ) : <span style={{ color: 'var(--txt-3)', fontSize: 11 }}>—</span>}
                      </td>

                      <td style={{ ...tdStyle, fontSize: 12, fontWeight: 500 }}>
                        {c.valorEstimado ? `R$ ${c.valorEstimado}` : <span style={{ color: 'var(--txt-3)' }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Painel de Detalhes ──────────────────────────────── */}
      {selected && (
        <div style={{ width: 320, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--bg-card)', flexShrink: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--txt)' }}>Detalhes do Cliente</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {!editMode && (
                <button onClick={() => setEditMode(true)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: 'var(--neon-dim)', border: '1px solid var(--neon-border)', color: 'var(--neon)' }}>Editar</button>
              )}
              <button onClick={() => { setSelected(null); setEditMode(false) }} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--txt-2)' }}>×</button>
            </div>
          </div>

          <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
            {/* Avatar e nome */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: stageInfo(selected.etapa || 'novo').color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 auto 10px' }}>{ini(selected.nome)}</div>
              <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--txt)' }}>{selected.nome || '—'}</p>
              <p style={{ fontSize: 11, color: 'var(--txt-2)', fontFamily: 'monospace' }}>{fmtPhone(selected.telefone)}</p>
            </div>

            {editMode ? (
              /* ── Modo de edição ────────────────────────────── */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={labelStyle}>Etapa do funil</label>
                  <select value={editEtapa} onChange={e => setEditEtapa(e.target.value as CRMStage)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13 }}>
                    {STAGES.map(s => <option key={s.key} value={s.key}>{s.icon} {s.label}</option>)}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Tags (separadas por vírgula)</label>
                  <input value={editTags} onChange={e => setEditTags(e.target.value)} placeholder="vip, urgente, indicação" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13 }} />
                </div>

                <div>
                  <label style={labelStyle}>Próximo follow-up</label>
                  <input type="date" value={editFollowUp} onChange={e => setEditFollowUp(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13 }} />
                </div>

                <div>
                  <label style={labelStyle}>Valor estimado (R$)</label>
                  <input value={editValor} onChange={e => setEditValor(e.target.value)} placeholder="1.500,00" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13 }} />
                </div>

                <div>
                  <label style={labelStyle}>Notas internas</label>
                  <textarea value={editNotas} onChange={e => setEditNotas(e.target.value)} placeholder="Observações sobre o cliente..." rows={3} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13, resize: 'vertical' }} />
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setEditMode(false)} style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, cursor: 'pointer', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--txt-2)' }}>Cancelar</button>
                  <button onClick={saveClient} disabled={saving} style={{ flex: 1, padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: 'var(--neon)', border: 'none', color: '#0a0a0a', opacity: saving ? 0.5 : 1 }}>
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </div>
            ) : (
              /* ── Modo de visualização ──────────────────────── */
              <>
                {/* Etapa */}
                <div style={{ marginBottom: 16 }}>
                  <p style={labelStyle}>Etapa do funil</p>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 100, background: `${stageInfo(selected.etapa || 'novo').color}18`, border: `1px solid ${stageInfo(selected.etapa || 'novo').color}40`, color: stageInfo(selected.etapa || 'novo').color }}>
                    {stageInfo(selected.etapa || 'novo').icon} {stageInfo(selected.etapa || 'novo').label}
                  </span>
                </div>

                {/* Tags */}
                {selected.tags && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={labelStyle}>Tags</p>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {selected.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => (
                        <span key={t} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 100, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--txt-2)' }}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Datas */}
                {[
                  ['Último contato', daysAgo(selected.ultimoContato) ?? '—'],
                  ['Próximo follow-up', selected.proximoFollowUp ? `${fmtDate(selected.proximoFollowUp)}${isOverdue(selected.proximoFollowUp) ? ' ⚠ ATRASADO' : ''}` : '—'],
                  ['Valor estimado', selected.valorEstimado ? `R$ ${selected.valorEstimado}` : '—'],
                  ['Atendente', selected.atendente || '—'],
                  ['Origem', selected.origem || '—'],
                ].map(([l, v]) => (
                  <div key={l} style={{ marginBottom: 12 }}>
                    <p style={labelStyle}>{l}</p>
                    <p style={{ fontSize: 13, color: String(v).includes('ATRASADO') ? '#EF4444' : 'var(--txt-2)', fontWeight: String(v).includes('ATRASADO') ? 600 : 400 }}>{v}</p>
                  </div>
                ))}

                {/* Notas */}
                {selected.notas && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={labelStyle}>Notas internas</p>
                    <p style={{ fontSize: 12, color: 'var(--txt-2)', lineHeight: 1.6, padding: '8px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)' }}>{selected.notas}</p>
                  </div>
                )}

                {/* Histórico */}
                {selected.historico && (
                  <div style={{ marginBottom: 16 }}>
                    <p style={labelStyle}>Histórico</p>
                    <p style={{ fontSize: 12, color: 'var(--txt-2)', wordBreak: 'break-word' }}>{selected.historico}</p>
                  </div>
                )}

                {/* Ações */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <p style={labelStyle}>Ações rápidas</p>
                  <a href={`/transcricoes?telefone=${selected.telefone}`} style={{ fontSize: 12, color: 'var(--neon)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}><IcoFileText size={12}/> Ver transcrições</a>
                  <a href={`/workspace`} style={{ fontSize: 12, color: 'var(--neon)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}><IcoMessageCircle size={12}/> Abrir em Conversas</a>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Toast ────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full text-[13px] font-medium z-[200]"
          style={{ background: 'var(--bg-card)', border: '1px solid rgba(163,230,53,0.3)', color: 'var(--neon)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}

// ── Estilos inline ───────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '10px 16px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '.07em', color: 'var(--txt-3)', textAlign: 'left',
  background: 'var(--bg-card)', position: 'sticky', top: 0, zIndex: 5,
  borderBottom: '1px solid var(--border)',
}

const tdStyle: React.CSSProperties = {
  padding: '10px 16px', fontSize: 13, color: 'var(--txt-2)', verticalAlign: 'middle',
}

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '.08em', color: 'var(--txt-3)', marginBottom: 4,
}
