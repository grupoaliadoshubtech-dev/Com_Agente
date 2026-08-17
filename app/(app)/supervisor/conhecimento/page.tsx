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

// ── Modal de edição / criação ──────────────────────────────────
function QAModal({
  item, onClose, onSaved,
}: {
  item?: QA
  onClose: () => void
  onSaved: () => void
}) {
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
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', backdropFilter:'blur(4px)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
    >
      <div className="card animate-slide-up" style={{ maxWidth:520, width:'100%', maxHeight:'90vh', overflowY:'auto', padding:0 }}>
        {/* Header */}
        <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, background:'var(--bg-card)', zIndex:1 }}>
          <h2 className="font-display" style={{ fontSize:14, fontWeight:700, color:'var(--txt)' }}>
            {item ? 'Editar pergunta & resposta' : 'Nova pergunta & resposta'}
          </h2>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'var(--txt-2)', lineHeight:1 }}>×</button>
        </div>

        <form onSubmit={save} style={{ padding:20, display:'flex', flexDirection:'column', gap:14 }}>
          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--txt-2)', marginBottom:5 }}>Categoria</label>
            <select
              value={categoria}
              onChange={e => setCategoria(e.target.value)}
              style={{ width:'100%', padding:'9px 12px', borderRadius:8 }}
            >
              {CATEGORIAS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--txt-2)', marginBottom:5 }}>
              Pergunta <span style={{ color:'var(--danger)', marginLeft:2 }}>*</span>
            </label>
            <textarea
              value={pergunta}
              onChange={e => setPergunta(e.target.value)}
              placeholder="Ex: Qual o horário de atendimento?"
              rows={3}
              style={{ width:'100%', padding:'9px 12px', resize:'vertical' }}
            />
          </div>

          <div>
            <label style={{ display:'block', fontSize:12, fontWeight:600, color:'var(--txt-2)', marginBottom:5 }}>
              Resposta <span style={{ color:'var(--danger)', marginLeft:2 }}>*</span>
            </label>
            <textarea
              value={resposta}
              onChange={e => setResposta(e.target.value)}
              placeholder="Ex: Nosso atendimento funciona de segunda a sexta, das 8h às 18h."
              rows={5}
              style={{ width:'100%', padding:'9px 12px', resize:'vertical' }}
            />
          </div>

          {error && (
            <div style={{ fontSize:13, color:'var(--danger)', background:'var(--danger-dim)', border:'1px solid rgba(239,68,68,.2)', borderRadius:8, padding:'8px 12px' }}>
              {error}
            </div>
          )}

          <div style={{ display:'flex', gap:10 }}>
            <button type="button" onClick={onClose} className="btn-outline" style={{ flex:1, padding:'10px', fontSize:13 }}>Cancelar</button>
            <button type="submit" disabled={loading} className="btn-neon" style={{ flex:1, padding:'10px', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', gap:8 }}>
              {loading ? <><span className="spinner" style={{ width:14, height:14 }}/>Salvando...</> : item ? 'Salvar alterações' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────
export default function ConhecimentoPage() {
  const [items,       setItems]       = useState<QA[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [catFilter,   setCatFilter]   = useState('')
  const [editing,     setEditing]     = useState<QA | undefined>()
  const [showNew,     setShowNew]     = useState(false)
  const [toast,       setToast]       = useState('')
  const [toastKind,   setToastKind]   = useState<'ok'|'err'>('ok')
  const [delConfirm,  setDelConfirm]  = useState<number | null>(null)

  // Upload states
  const [dragOver,    setDragOver]    = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const [uploadMsg,   setUploadMsg]   = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function showToast(msg: string, kind: 'ok' | 'err' = 'ok') {
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

  // ── Upload ─────────────────────────────────────────────────
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
    } catch {
      showToast('Falha de conexão ao enviar arquivo', 'err')
    }
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

  // ── Toggle ativo ───────────────────────────────────────────
  async function toggleActive(item: QA) {
    await fetch(`/api/knowledge/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !item.isActive }),
    })
    load()
    showToast(item.isActive ? 'Item desativado' : '✓ Item ativado')
  }

  // ── Delete ─────────────────────────────────────────────────
  async function deleteItem(id: number) {
    const r = await fetch(`/api/knowledge/${id}`, { method: 'DELETE' })
    const d = await r.json()
    setDelConfirm(null)
    if (d.success) { load(); showToast('✓ Item excluído') }
    else showToast(d.error ?? 'Erro ao excluir', 'err')
  }

  // ── Filtro local ───────────────────────────────────────────
  const filtered = items.filter(i => {
    const q = search.toLowerCase()
    const matchText = !q || i.pergunta.toLowerCase().includes(q) || i.resposta.toLowerCase().includes(q)
    const matchCat  = !catFilter || i.categoria === catFilter
    return matchText && matchCat
  })

  const activeCount   = items.filter(i => i.isActive).length
  const inactiveCount = items.length - activeCount

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden' }}>
      {/* ── Top bar ── */}
      <div style={{ padding:'14px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, flexShrink:0, background:'var(--bg-card)' }}>
        <div style={{ flex:1 }}>
          <div className="font-display" style={{ fontSize:16, fontWeight:700, color:'var(--txt)' }}>Base de Conhecimento</div>
          <div style={{ fontSize:11, color:'var(--txt-2)', marginTop:2 }}>
            {items.length} item{items.length !== 1 ? 's' : ''} · {activeCount} ativo{activeCount !== 1 ? 's' : ''} · {inactiveCount} inativo{inactiveCount !== 1 ? 's' : ''}
          </div>
        </div>
        <button onClick={() => setShowNew(true)} className="btn-neon" style={{ padding:'9px 16px', fontSize:13 }}>+ Adicionar</button>
        <button onClick={load} style={{ padding:'8px 12px', borderRadius:8, fontSize:12, cursor:'pointer', background:'var(--bg-input)', border:'1px solid var(--border)', color:'var(--txt-2)', fontFamily:"'Plus Jakarta Sans',sans-serif" }}>↻</button>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:20, display:'flex', flexDirection:'column', gap:16 }}>

        {/* ── Upload card ── */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          <div style={{ padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:14 }}>📄</span>
            <span className="font-display" style={{ fontSize:13, fontWeight:700, color:'var(--txt)' }}>Importar documento</span>
            <span style={{ fontSize:11, color:'var(--txt-3)', marginLeft:4 }}>PDF · TXT · Imagem · DOCX — máx 25 MB</span>
          </div>
          <div style={{ padding:16 }}>
            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => !uploading && fileRef.current?.click()}
              style={{
                border: `2px dashed ${dragOver ? 'var(--neon)' : 'var(--border)'}`,
                borderRadius: 10,
                padding: '28px 20px',
                textAlign: 'center',
                cursor: uploading ? 'not-allowed' : 'pointer',
                background: dragOver ? 'rgba(34,211,238,.06)' : 'var(--bg-input)',
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
                  <div style={{ fontSize:28, marginBottom:8 }}>☁️</div>
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
              <div style={{ marginTop:10, fontSize:12, color:'var(--neon)', background:'rgba(34,211,238,.08)', border:'1px solid rgba(34,211,238,.2)', borderRadius:8, padding:'8px 12px' }}>
                {uploadMsg} — recarregue a lista em alguns instantes para ver os itens importados.
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
            style={{ flex:1, padding:'9px 12px' }}
          />
          <select
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
            style={{ padding:'9px 12px', borderRadius:8, minWidth:140 }}
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
            <span style={{ fontSize:32 }}>🧠</span>
            <p style={{ fontSize:13 }}>{items.length === 0 ? 'Nenhum item ainda — importe um documento ou adicione manualmente' : 'Nenhum item corresponde ao filtro'}</p>
            {items.length === 0 && (
              <button onClick={() => setShowNew(true)} style={{ fontSize:13, color:'var(--neon)', background:'none', border:'none', cursor:'pointer' }}>
                Adicionar primeiro item →
              </button>
            )}
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {filtered.map(item => (
              <div
                key={item.id}
                className="card"
                style={{ padding:14, opacity: item.isActive ? 1 : 0.5, transition:'opacity .2s' }}
              >
                <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                  {/* Categoria pill */}
                  <span style={{
                    flexShrink:0, fontSize:10, fontWeight:700, padding:'2px 8px',
                    borderRadius:20, background:'var(--bg-input)', color:'var(--txt-2)',
                    border:'1px solid var(--border)', textTransform:'uppercase', letterSpacing:'.05em',
                    marginTop:2,
                  }}>
                    {item.categoria}
                  </span>

                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:13, fontWeight:700, color:'var(--txt)', marginBottom:4, lineHeight:1.4 }}>
                      {item.pergunta}
                    </p>
                    <p style={{ fontSize:12, color:'var(--txt-2)', lineHeight:1.5 }}>
                      {item.resposta}
                    </p>
                    <p style={{ fontSize:10, color:'var(--txt-3)', marginTop:6 }}>
                      Criado em {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>

                  {/* Ações */}
                  <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                    <button
                      onClick={() => setEditing(item)}
                      title="Editar"
                      style={{ padding:'5px 10px', borderRadius:7, fontSize:12, cursor:'pointer', background:'var(--bg-input)', border:'1px solid var(--border)', color:'var(--txt-2)', fontFamily:"'Plus Jakarta Sans',sans-serif" }}
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => toggleActive(item)}
                      title={item.isActive ? 'Desativar' : 'Ativar'}
                      style={{ padding:'5px 10px', borderRadius:7, fontSize:12, cursor:'pointer', background: item.isActive ? 'rgba(239,68,68,.08)' : 'rgba(16,185,129,.08)', border:`1px solid ${item.isActive ? 'rgba(239,68,68,.3)' : 'rgba(16,185,129,.3)'}`, color: item.isActive ? '#FCA5A5' : '#6EE7B7', fontFamily:"'Plus Jakarta Sans',sans-serif" }}
                    >
                      {item.isActive ? '⏸' : '▶'}
                    </button>
                    <button
                      onClick={() => setDelConfirm(item.id)}
                      title="Excluir"
                      style={{ padding:'5px 10px', borderRadius:7, fontSize:12, cursor:'pointer', background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.3)', color:'#FCA5A5', fontFamily:"'Plus Jakarta Sans',sans-serif" }}
                    >
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modais ── */}
      {showNew   && <QAModal onClose={() => setShowNew(false)}   onSaved={() => { setShowNew(false);   load(); showToast('✓ Item criado') }}/>}
      {editing   && <QAModal item={editing} onClose={() => setEditing(undefined)} onSaved={() => { setEditing(undefined); load(); showToast('✓ Item atualizado') }}/>}

      {/* Modal confirmação de exclusão */}
      {delConfirm !== null && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setDelConfirm(null) }}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', backdropFilter:'blur(4px)', zIndex:100, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
        >
          <div className="card" style={{ maxWidth:360, width:'100%', padding:24, textAlign:'center' }}>
            <div style={{ fontSize:32, marginBottom:12 }}>🗑️</div>
            <p className="font-display" style={{ fontWeight:700, fontSize:15, color:'var(--txt)', marginBottom:8 }}>Excluir item?</p>
            <p style={{ fontSize:13, color:'var(--txt-2)', marginBottom:20 }}>Esta ação não pode ser desfeita.</p>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setDelConfirm(null)} className="btn-outline" style={{ flex:1, padding:'10px', fontSize:13 }}>Cancelar</button>
              <button onClick={() => deleteItem(delConfirm)} style={{ flex:1, padding:'10px', fontSize:13, borderRadius:9, background:'var(--danger)', color:'#fff', border:'none', cursor:'pointer', fontFamily:"'Plus Jakarta Sans',sans-serif", fontWeight:700 }}>Excluir</button>
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
