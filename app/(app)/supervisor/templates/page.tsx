'use client'
// ─────────────────────────────────────────────────────────────
// app/(app)/supervisor/templates/page.tsx
// FASE 5 — Gestão de respostas rápidas pelo supervisor.
// CRUD completo de templates com preview da mensagem.
// ─────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'
import { IcoMessageCircle } from '@/components/icons'

interface Template {
  id: string; atalho: string; titulo: string
  mensagem: string; categoria: string; criadoPor: string
  createdAt: string; isActive: boolean
}

const CATEGORIAS = ['geral', 'vendas', 'suporte', 'follow-up', 'saudacao', 'encerramento']

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading]     = useState(true)
  const [toast, setToast]         = useState('')
  const [showForm, setShowForm]   = useState(false)
  const [editId, setEditId]       = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)

  // Form fields
  const [fAtalho, setFAtalho]       = useState('')
  const [fTitulo, setFTitulo]       = useState('')
  const [fMensagem, setFMensagem]   = useState('')
  const [fCategoria, setFCategoria] = useState('geral')

  function showToastMsg(m: string) { setToast(m); setTimeout(() => setToast(''), 3500) }

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/templates', { cache: 'no-store' })
      const d = await r.json()
      if (d.success) setTemplates(d.data ?? [])
    } catch {} finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  function openNew() {
    setEditId(null)
    setFAtalho(''); setFTitulo(''); setFMensagem(''); setFCategoria('geral')
    setShowForm(true)
  }

  function openEdit(t: Template) {
    setEditId(t.id)
    setFAtalho(t.atalho.replace(/^\//, ''))
    setFTitulo(t.titulo)
    setFMensagem(t.mensagem)
    setFCategoria(t.categoria)
    setShowForm(true)
  }

  async function save() {
    if (!fAtalho.trim() || !fTitulo.trim() || !fMensagem.trim()) {
      showToastMsg('Preencha todos os campos'); return
    }
    setSaving(true)
    try {
      const method = editId ? 'PUT' : 'POST'
      const body = editId
        ? { id: editId, atalho: fAtalho, titulo: fTitulo, mensagem: fMensagem, categoria: fCategoria }
        : { atalho: fAtalho, titulo: fTitulo, mensagem: fMensagem, categoria: fCategoria }

      const r = await fetch('/api/templates', {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const d = await r.json()
      if (d.success) {
        showToastMsg(editId ? '✓ Template atualizado' : '✓ Template criado')
        setShowForm(false); load()
      } else showToastMsg('Erro: ' + d.error)
    } catch { showToastMsg('Erro ao salvar') }
    finally { setSaving(false) }
  }

  async function remove(id: string) {
    if (!confirm('Remover este template?')) return
    try {
      const r = await fetch(`/api/templates?id=${id}`, { method: 'DELETE' })
      const d = await r.json()
      if (d.success) { showToastMsg('Template removido'); load() }
      else showToastMsg('Erro: ' + d.error)
    } catch { showToastMsg('Erro ao remover') }
  }

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 10, color: 'var(--txt-2)' }}><span className="spinner" style={{ width: 18, height: 18 }} /><span style={{ fontSize: 13 }}>Carregando templates...</span></div>

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontFamily: "'Syne',sans-serif", fontSize: 18, fontWeight: 700, color: 'var(--txt)', margin: 0 }}>Respostas Rápidas</h1>
          <p style={{ fontSize: 12, color: 'var(--txt-2)', marginTop: 4 }}>
            {templates.length} templates · Atendentes usam digitando <code style={{ background: 'var(--bg-input)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>/atalho</code> no chat
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={openNew} style={{ padding: '9px 18px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--neon)', border: 'none', color: '#0a0a0a' }}>
            + Novo Template
          </button>
          <button onClick={load} style={{ padding: '9px 12px', borderRadius: 8, fontSize: 14, cursor: 'pointer', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--txt-2)' }}>↻</button>
        </div>
      </div>

      {/* Lista de templates */}
      {templates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--txt-3)' }}>
          <div style={{ marginBottom: 12, color: 'var(--txt-3)' }}><IcoMessageCircle size={40}/></div>
          <p style={{ fontSize: 14 }}>Nenhum template criado</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>Crie respostas rápidas para agilizar o atendimento</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {templates.map(t => (
            <div key={t.id} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
              padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <code style={{ background: 'var(--neon-dim)', color: 'var(--neon)', padding: '3px 10px', borderRadius: 6, fontSize: 13, fontWeight: 600, border: '1px solid var(--neon-border)' }}>
                    {t.atalho}
                  </code>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 100, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--txt-2)' }}>
                    {t.categoria}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button onClick={() => openEdit(t)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--txt-2)' }}>Editar</button>
                  <button onClick={() => remove(t.id)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#EF4444' }}>Remover</button>
                </div>
              </div>

              <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--txt)' }}>{t.titulo}</p>

              <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p style={{ fontSize: 13, color: 'var(--txt-2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{t.mensagem}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de criação/edição */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false) }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 24, maxWidth: 500, width: '100%' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--txt)', marginBottom: 16 }}>
              {editId ? 'Editar Template' : 'Novo Template'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Atalho</label>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ padding: '8px 10px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRight: 'none', borderRadius: '8px 0 0 8px', fontSize: 14, color: 'var(--neon)', fontWeight: 600 }}>/</span>
                    <input value={fAtalho} onChange={e => setFAtalho(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))} placeholder="saudacao" style={{ flex: 1, padding: '8px 10px', borderRadius: '0 8px 8px 0', fontSize: 13 }} />
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Categoria</label>
                  <select value={fCategoria} onChange={e => setFCategoria(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13 }}>
                    {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={labelStyle}>Título</label>
                <input value={fTitulo} onChange={e => setFTitulo(e.target.value)} placeholder="Saudação inicial" style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13 }} />
              </div>

              <div>
                <label style={labelStyle}>Mensagem</label>
                <textarea value={fMensagem} onChange={e => setFMensagem(e.target.value)} placeholder="Olá! Bem-vindo à nossa empresa. Como posso ajudar?" rows={4} style={{ width: '100%', padding: '8px 10px', borderRadius: 8, fontSize: 13, resize: 'vertical' }} />
                <p style={{ fontSize: 10, color: 'var(--txt-3)', marginTop: 4 }}>
                  Use {'{{nome}}'} para inserir o nome do contato automaticamente
                </p>
              </div>

              {/* Preview */}
              {fMensagem && (
                <div>
                  <label style={labelStyle}>Preview</label>
                  <div style={{ background: 'var(--neon)', color: '#0a0a0a', padding: '10px 14px', borderRadius: '12px 12px 4px 12px', fontSize: 13, lineHeight: 1.6, maxWidth: '80%', marginLeft: 'auto', whiteSpace: 'pre-wrap' }}>
                    {fMensagem.replace(/\{\{nome\}\}/g, 'João')}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--txt-2)' }}>Cancelar</button>
                <button onClick={save} disabled={saving} style={{ flex: 1, padding: '10px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'var(--neon)', border: 'none', color: '#0a0a0a', opacity: saving ? 0.5 : 1 }}>
                  {saving ? 'Salvando...' : editId ? 'Atualizar' : 'Criar Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full text-[13px] font-medium z-[200]"
          style={{ background: 'var(--bg-card)', border: '1px solid rgba(163,230,53,0.3)', color: 'var(--neon)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
  letterSpacing: '.06em', color: 'var(--txt-3)', marginBottom: 4, display: 'block',
}
