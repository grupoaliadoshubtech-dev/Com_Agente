'use client'

import { useEffect, useRef, useState } from 'react'

interface QA {
  id:        number
  pergunta:  string
  resposta:  string
  categoria: string
  createdAt: string
  isActive:  boolean
}

const CATEGORIAS = ['geral', 'produto', 'serviço', 'preço', 'suporte', 'processo', 'empresa', 'outros']

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
  border: '1px solid var(--border-md)', background: 'var(--bg-input)',
  color: 'var(--txt)', fontFamily: "'Plus Jakarta Sans',sans-serif", outline: 'none',
  boxSizing: 'border-box',
}
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
  letterSpacing: '.07em', color: 'var(--txt-3)', marginBottom: 5,
}

// ── Modal de edição / criação ──────────────────────────────────
function QAModal({ item, onClose, onSaved }: { item?: QA; onClose: () => void; onSaved: () => void }) {
  const [pergunta,  setPergunta]  = useState(item?.pergunta  ?? '')
  const [resposta,  setResposta]  = useState(item?.resposta  ?? '')
  const [categoria, setCategoria] = useState(item?.categoria ?? 'geral')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!pergunta.trim() || !resposta.trim()) { setError('Pergunta e resposta são obrigatórias'); return }
    setLoading(true)
    const url    = item ? `/api/knowledge/${item.id}` : '/api/knowledge'
    const method = item ? 'PATCH' : 'POST'
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pergunta: pergunta.trim(), resposta: resposta.trim(), categoria }),
    })
    const d = await r.json()
    setLoading(false)
    if (d.success) onSaved()
    else setError(d.error ?? 'Erro ao salvar')
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', backdropFilter:'blur(4px)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
    >
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:14, maxWidth:520, width:'100%', maxHeight:'90vh', overflowY:'auto', padding:0 }}
        className="animate-slide-up">
        {/* Header */}
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, background:'var(--bg-card)', zIndex:1 }}>
          <h3 className="font-display" style={{ fontSize:14, fontWeight:700, color:'var(--txt)', margin:0 }}>
            {item ? 'Editar pergunta & resposta' : 'Nova pergunta & resposta'}
          </h3>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'var(--txt-2)', lineHeight:1, padding:'2px 6px' }}>×</button>
        </div>

        <form onSubmit={save} style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={labelStyle}>Categoria</label>
            <select value={categoria} onChange={e => setCategoria(e.target.value)} style={inputStyle}>
              {CATEGORIAS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>

          <div>
            <label style={labelStyle}>
              Pergunta <span style={{ color:'var(--danger)' }}>*</span>
            </label>
            <textarea
              value={pergunta}
              onChange={e => setPergunta(e.target.value)}
              placeholder="Ex: Qual o horário de atendimento?"
              rows={3}
              style={{ ...inputStyle, resize:'vertical' }}
            />
          </div>

          <div>
            <label style={labelStyle}>
              Resposta <span style={{ color:'var(--danger)' }}>*</span>
            </label>
            <textarea
              value={resposta}
              onChange={e => setResposta(e.target.value)}
              placeholder="Ex: Nosso atendimento funciona de segunda a sexta, das 8h às 18h."
              rows={5}
              style={{ ...inputStyle, resize:'vertical' }}
            />
          </div>

          {error && (
            <div style={{ fontSize:13, color:'var(--danger)', background:'rgba(220,38,38,.08)', border:'1px solid rgba(220,38,38,.2)', borderRadius:8, padding:'8px 12px', display:'flex', alignItems:'center', gap:8 }}>
              <span>⚠</span>{error}
            </div>
          )}

          <div style={{ display:'flex', gap:10, marginTop:2 }}>
            <button type="button" onClick={onClose} className="btn-outline" style={{ flex:1, padding:'10px', fontSize:13 }}>Cancelar</button>
            <button type="submit" disabled={loading} className="btn-neon" style={{ flex:1, padding:'10px', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {loading
                ? <><span className="spinner" style={{ width:14, height:14 }}/>Salvando…</>
                : item ? 'Salvar alterações' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────
export default function ConhecimentoPage() {
  const [items,      setItems]      = useState<QA[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [catFilter,  setCatFilter]  = useState('')
  const [editing,    setEditing]    = useState<QA | undefined>()
  const [showNew,    setShowNew]    = useState(false)
  const [toast,      setToast]      = useState('')
  const [toastKind,  setToastKind]  = useState<'ok'|'err'>('ok')
  const [delConfirm, setDelConfirm] = useState<number | null>(null)

  const [dragOver,   setDragOver]   = useState(false)
  const [uploading,  setUploading]  = useState(false)
  const [uploadMsg,  setUploadMsg]  = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function showToast(msg: string, kind: 'ok'|'err' = 'ok') {
    setToast(msg); setToastKind(kind)
    setTimeout(() => setToast(''), 4000)
  }

  async function load() {
    setLoading(true)
    try {
      const r = await fetch('/api/knowledge', { cache: 'no-store' })
      const d = await r.json()
      if (d.success) setItems(d.data ?? [])
    } catch { /* silencioso */ }
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function handleUpload(file: File) {
    setUploadMsg('')
    if (file.size > 25 * 1024 * 1024) { showToast('Arquivo maior que 25 MB', 'err'); return }
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const r = await fetch('/api/knowledge/upload', { method: 'POST', body: fd })
      const d = await r.json()
      if (d.success) {
        setUploadMsg(d.message ?? 'Enviado! As perguntas aparecerão em instantes.')
        showToast('✓ Documento enviado para processamento')
      } else {
        showToast(d.error ?? 'Erro no upload', 'err')
      }
    } catch { showToast('Falha de conexão ao enviar arquivo', 'err') }
    setUploading(false)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    e.target.value = ''
  }

  async function toggleActive(item: QA) {
    await fetch(`/api/knowledge/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !item.isActive }),
    })
    load()
    showToast(item.isActive ? 'Item desativado' : '✓ Item ativado')
  }

  async function deleteItem(id: number) {
    const r = await fetch(`/api/knowledge/${id}`, { method: 'DELETE' })
    const d = await r.json()
    setDelConfirm(null)
    if (d.success) { load(); showToast('✓ Item excluído') }
    else showToast(d.error ?? 'Erro ao excluir', 'err')
  }

  const filtered = items.filter(i => {
    const q = search.toLowerCase()
    const matchText = !q || i.pergunta.toLowerCase().includes(q) || i.resposta.toLowerCase().includes(q)
    const matchCat  = !catFilter || i.categoria === catFilter
    return matchText && matchCat
  })

  const activeCount   = items.filter(i => i.isActive).length
  const inactiveCount = items.length - activeCount

  return (
    <div style={{ height:'100%', overflow:'auto', padding:20, display:'flex', flexDirection:'column', gap:16 }}>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div>
          <h1 className="font-display" style={{ fontSize:18, fontWeight:700, color:'var(--txt)', margin:0 }}>Base de Conhecimento</h1>
          <p style={{ fontSize:12, color:'var(--txt-2)', marginTop:4 }}>
            {items.length} item{items.length !== 1 ? 's' : ''} · {activeCount} ativo{activeCount !== 1 ? 's' : ''} · {inactiveCount} inativo{inactiveCount !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => setShowNew(true)} className="btn-neon" style={{ padding:'9px 18px', fontSize:13 }}>+ Adicionar</button>
          <button onClick={load} style={{ padding:'9px 12px', borderRadius:8, fontSize:14, cursor:'pointer', background:'var(--bg-input)', border:'1px solid var(--border)', color:'var(--txt-2)', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>↻</button>
        </div>
      </div>

      {/* ── Upload card ── */}
      <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
        <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8 }}>
          <svg width="15" height="15" fill="none" stroke="var(--neon)" strokeWidth="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          <span className="font-display" style={{ fontSize:13, fontWeight:700, color:'var(--txt)' }}>Importar documento</span>
          <span style={{ fontSize:11, color:'var(--txt-3)', marginLeft:2 }}>PDF · TXT · Imagem · DOCX — máx 25 MB</span>
        </div>
        <div style={{ padding:16 }}>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => !uploading && fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? 'var(--neon)' : 'var(--border)'}`,
              borderRadius: 10, padding: '28px 20px', textAlign: 'center',
              cursor: uploading ? 'not-allowed' : 'pointer',
              background: dragOver ? 'rgba(163,230,53,.06)' : 'var(--bg-input)',
              transition: 'all .2s',
            }}
          >
            {uploading ? (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
                <span className="spinner" style={{ width:24, height:24 }}/>
                <span style={{ fontSize:13, color:'var(--txt-2)' }}>Enviando para o N8N processar…</span>
              </div>
            ) : (
              <>
                <div style={{ marginBottom:10 }}>
                  <svg width="28" height="28" fill="none" stroke="var(--txt-3)" strokeWidth="1.5" viewBox="0 0 24 24" style={{ margin:'0 auto' }}><polyline points="16,16 12,12 8,16"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/></svg>
                </div>
                <p style={{ fontSize:13, fontWeight:600, color:'var(--txt)', marginBottom:4 }}>
                  Arraste um arquivo aqui ou clique para selecionar
                </p>
                <p style={{ fontSize:11, color:'var(--txt-3)' }}>
                  A IA do N8N irá extrair as perguntas e respostas automaticamente
                </p>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" hidden accept=".pdf,.txt,.docx,.doc,.jpg,.jpeg,.png,.webp" onChange={onFileChange}/>

          {uploadMsg && (
            <div style={{ marginTop:10, fontSize:12, color:'var(--neon)', background:'rgba(163,230,53,.08)', border:'1px solid rgba(163,230,53,.2)', borderRadius:8, padding:'8px 12px' }}>
              {uploadMsg} — recarregue a lista em alguns instantes.
            </div>
          )}
        </div>
      </div>

      {/* ── Filtros ── */}
      <div style={{ display:'flex', gap:10 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por pergunta ou resposta…"
          style={{ ...inputStyle, flex:1 }}
        />
        <select
          value={catFilter}
          onChange={e => setCatFilter(e.target.value)}
          style={{ ...inputStyle, width:'auto', minWidth:150 }}
        >
          <option value="">Todas categorias</option>
          {CATEGORIAS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
      </div>

      {/* ── Lista Q&A ── */}
      {loading ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:200, gap:10, color:'var(--txt-2)' }}>
          <span className="spinner" style={{ width:18, height:18 }}/><span style={{ fontSize:13 }}>Carregando…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:200, gap:8, color:'var(--txt-3)' }}>
          <svg width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          <p style={{ fontSize:13 }}>{items.length === 0 ? 'Nenhum item ainda — importe um documento ou adicione manualmente' : 'Nenhum item corresponde ao filtro'}</p>
          {items.length === 0 && (
            <button onClick={() => setShowNew(true)} style={{ fontSize:13, color:'var(--neon)', background:'none', border:'none', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
              Adicionar primeiro item →
            </button>
          )}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {filtered.map(item => (
            <div
              key={item.id}
              style={{
                background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:12,
                padding:14, opacity: item.isActive ? 1 : 0.5, transition:'opacity .2s',
                borderLeft: item.isActive ? '3px solid var(--neon)' : '3px solid var(--border)',
              }}
            >
              <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                {/* Categoria pill */}
                <span style={{
                  flexShrink:0, fontSize:10, fontWeight:700, padding:'3px 8px',
                  borderRadius:20, background:'rgba(163,230,53,.1)', color:'var(--neon)',
                  border:'1px solid rgba(163,230,53,.2)', textTransform:'uppercase', letterSpacing:'.05em', marginTop:2,
                }}>
                  {item.categoria}
                </span>

                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:13, fontWeight:700, color:'var(--txt)', marginBottom:6, lineHeight:1.4 }}>
                    {item.pergunta}
                  </p>
                  <p style={{ fontSize:12, color:'var(--txt-2)', lineHeight:1.6 }}>
                    {item.resposta}
                  </p>
                  <p style={{ fontSize:10, color:'var(--txt-3)', marginTop:6 }}>
                    Criado em {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                    {!item.isActive && <span style={{ color:'var(--danger)', marginLeft:8, fontWeight:600 }}>· Inativo</span>}
                  </p>
                </div>

                {/* Ações */}
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button
                    onClick={() => setEditing(item)}
                    title="Editar"
                    style={{ padding:'5px 10px', borderRadius:7, fontSize:12, cursor:'pointer', background:'var(--bg-input)', border:'1px solid var(--border)', color:'var(--txt-2)', fontFamily:"'Plus Jakarta Sans',sans-serif" }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => toggleActive(item)}
                    title={item.isActive ? 'Desativar' : 'Ativar'}
                    style={{
                      padding:'5px 10px', borderRadius:7, fontSize:12, cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif",
                      background: item.isActive ? 'rgba(220,38,38,.08)' : 'rgba(16,185,129,.08)',
                      border: `1px solid ${item.isActive ? 'rgba(220,38,38,.3)' : 'rgba(16,185,129,.3)'}`,
                      color: item.isActive ? 'var(--danger)' : '#34d399',
                    }}
                  >
                    {item.isActive ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    onClick={() => setDelConfirm(item.id)}
                    title="Excluir"
                    style={{ padding:'5px 10px', borderRadius:7, fontSize:12, cursor:'pointer', background:'rgba(220,38,38,.08)', border:'1px solid rgba(220,38,38,.3)', color:'var(--danger)', fontFamily:"'Plus Jakarta Sans',sans-serif" }}
                  >
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modais ── */}
      {showNew  && <QAModal onClose={() => setShowNew(false)}  onSaved={() => { setShowNew(false);  load(); showToast('✓ Item criado') }}/>}
      {editing  && <QAModal item={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); load(); showToast('✓ Item atualizado') }}/>}

      {/* Modal confirmação de exclusão */}
      {delConfirm !== null && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setDelConfirm(null) }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', backdropFilter:'blur(4px)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
        >
          <div style={{ background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:14, maxWidth:360, width:'100%', padding:24, textAlign:'center' }} className="animate-slide-up">
            <div style={{ width:48, height:48, borderRadius:'50%', background:'rgba(220,38,38,.1)', border:'2px solid rgba(220,38,38,.25)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px' }}>
              <svg width="20" height="20" fill="none" stroke="var(--danger)" strokeWidth="2" viewBox="0 0 24 24"><polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
            </div>
            <p className="font-display" style={{ fontWeight:700, fontSize:15, color:'var(--txt)', marginBottom:8 }}>Excluir item?</p>
            <p style={{ fontSize:13, color:'var(--txt-2)', marginBottom:20 }}>Esta ação não pode ser desfeita.</p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setDelConfirm(null)} className="btn-outline" style={{ flex:1, padding:'10px', fontSize:13 }}>Cancelar</button>
              <button onClick={() => deleteItem(delConfirm)} className="btn-danger" style={{ flex:1, padding:'10px', fontSize:13, borderRadius:9 }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast-base" style={{ background: toastKind === 'err' ? 'var(--danger)' : undefined }}>
          {toast}
        </div>
      )}
    </div>
  )
}
