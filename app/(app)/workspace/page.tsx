'use client'
// ─────────────────────────────────────────────────────────────
// app/(app)/workspace/page.tsx
// CONSOLIDADO — Chat em tempo real (F1) + Mídia (F2) + Templates (F5)
// ─────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useHandoff } from '@/lib/hooks/use-handoff'
import { useTemplates } from '@/lib/hooks/use-templates'
import { IcoMapPin, IcoUser, IcoBan, IcoMessageCircle } from '@/components/icons'
import { TemplateMenu } from '@/components/template-menu'

// ── Tipos ────────────────────────────────────────────────────

interface ChatContact {
  telefone: string; remoteJid: string; lidJid: string | null; nome: string; preview: string
  timestamp: string; iaStatus: string; unreadCount: number; profilePicUrl: string | null
}

interface ChatMessage {
  id: string; remoteJid: string; type: 'incoming' | 'outgoing'; text: string
  time: string; timestamp: string; pushName: string; fromMe: boolean
  mediaType: string | null; mimetype: string | null; caption: string | null
  duration: number | null; fileName: string | null; isPtt: boolean; status: string | null
}

// ── Config ───────────────────────────────────────────────────

const CHAT_POLL = 5000
const MSG_POLL  = 3000

// ── Helpers ──────────────────────────────────────────────────

function ini(n: string) { return n.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase() || '??' }

function timeAgo(iso: string) {
  if (!iso) return ''
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'agora'; if (m < 60) return m + 'm'
  const h = Math.floor(m / 60); if (h < 24) return h + 'h'
  const d = Math.floor(h / 24); if (d < 7) return d + 'd'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function fmtPhone(p: string) {
  if (p.length === 13 && p.startsWith('55'))
    return `+${p.slice(0, 2)} (${p.slice(2, 4)}) ${p.slice(4, 9)}-${p.slice(9)}`
  return p
}

function fmtDuration(sec: number | null) {
  if (!sec) return '0:00'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ── Componente de Mídia ──────────────────────────────────────

function MediaBubble({ msg }: { msg: ChatMessage }) {
  const [mediaData, setMediaData] = useState<{ base64: string; mimetype: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)

  const loadMedia = useCallback(async () => {
    if (mediaData || loading || !msg.mediaType) return
    if (msg.mediaType === 'location' || msg.mediaType === 'contact') return
    setLoading(true)
    try {
      const res = await fetch(`/api/evolution/media?messageId=${msg.id}&remoteJid=${encodeURIComponent(msg.remoteJid)}`)
      const data = await res.json()
      if (data.success && data.data) {
        setMediaData({ base64: data.data.base64, mimetype: data.data.mimetype })
      } else {
        setError(true)
      }
    } catch { setError(true) }
    finally { setLoading(false) }
  }, [msg.id, msg.remoteJid, msg.mediaType, mediaData, loading])

  // Auto-load imagens e stickers
  useEffect(() => {
  if ((msg.mediaType === 'image' || msg.mediaType === 'sticker') && !error) loadMedia()
}, [msg.mediaType, loadMedia, error])

  const isOut = msg.type === 'outgoing'

  // ── Imagem ─────────────────────────────────────────────
  if (msg.mediaType === 'image' || msg.mediaType === 'sticker') {
    return (
      <div>
        {loading && <div style={{ width: 220, height: 160, borderRadius: 12, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#888' }}>Carregando...</div>}
        {error && <div style={{ padding: '8px 12px', fontSize: 12, color: '#EF4444' }}>Erro ao carregar imagem</div>}
        {mediaData && (
          <img
            src={`data:${mediaData.mimetype};base64,${mediaData.base64}`}
            alt="imagem"
            style={{ maxWidth: 260, maxHeight: 300, borderRadius: 12, display: 'block' }}
          />
        )}
        {msg.caption && <p style={{ fontSize: 13, marginTop: 4, padding: '0 2px' }}>{msg.caption}</p>}
      </div>
    )
  }

  // ── Áudio ──────────────────────────────────────────────
  if (msg.mediaType === 'audio') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 200 }}>
        <button
          onClick={async () => {
            if (!mediaData) { await loadMedia(); return }
            if (audioRef.current) {
              if (playing) { audioRef.current.pause(); setPlaying(false) }
              else { audioRef.current.play(); setPlaying(true) }
            }
          }}
          style={{
            width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: isOut ? 'rgba(0,0,0,0.15)' : 'rgba(163,230,53,0.2)',
            color: isOut ? '#0a0a0a' : 'var(--neon)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0,
          }}>
          {loading ? '...' : playing ? '⏸' : '▶'}
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            height: 4, borderRadius: 2, width: '100%',
            background: isOut ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.1)',
          }} />
          <div style={{ fontSize: 10, marginTop: 3, opacity: 0.7 }}>
            {msg.isPtt ? '🎤 ' : '🎵 '}{fmtDuration(msg.duration)}
          </div>
        </div>
        {mediaData && (
          <audio
            ref={audioRef}
            src={`data:${mediaData.mimetype};base64,${mediaData.base64}`}
            onEnded={() => setPlaying(false)}
            style={{ display: 'none' }}
          />
        )}
      </div>
    )
  }

  // ── Vídeo ──────────────────────────────────────────────
  if (msg.mediaType === 'video') {
    return (
      <div>
        {!mediaData && !loading && (
          <button onClick={loadMedia} style={{
            width: 220, height: 130, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: 'rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 6, color: '#888', fontSize: 12,
          }}>
            <span style={{ fontSize: 28 }}>▶</span>
            Carregar vídeo {msg.duration ? `(${fmtDuration(msg.duration)})` : ''}
          </button>
        )}
        {loading && <div style={{ width: 220, height: 130, borderRadius: 12, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#888' }}>Carregando...</div>}
        {error && <div style={{ padding: '8px 12px', fontSize: 12, color: '#EF4444' }}>Erro ao carregar vídeo</div>}
        {mediaData && (
          <video
            controls
            style={{ maxWidth: 280, maxHeight: 200, borderRadius: 12 }}
            src={`data:${mediaData.mimetype};base64,${mediaData.base64}`}
          />
        )}
        {msg.caption && <p style={{ fontSize: 13, marginTop: 4 }}>{msg.caption}</p>}
      </div>
    )
  }

  // ── Documento ──────────────────────────────────────────
  if (msg.mediaType === 'document') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0',
        minWidth: 200, cursor: 'pointer',
      }} onClick={async () => {
        if (!mediaData) { await loadMedia(); return }
        // Download do documento
        const link = document.createElement('a')
        link.href = `data:${mediaData.mimetype};base64,${mediaData.base64}`
        link.download = msg.fileName ?? 'documento'
        link.click()
      }}>
        <div style={{
          width: 40, height: 44, borderRadius: 8, flexShrink: 0,
          background: isOut ? 'rgba(0,0,0,0.12)' : 'rgba(163,230,53,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
        }}>
          📄
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {msg.fileName ?? 'Documento'}
          </p>
          <p style={{ fontSize: 10, opacity: 0.6 }}>
            {loading ? 'Baixando...' : 'Clique para baixar'}
          </p>
        </div>
      </div>
    )
  }

  // ── Localização ────────────────────────────────────────
  if (msg.mediaType === 'location') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <IcoMapPin size={22}/>
        <span style={{ fontSize: 13 }}>{msg.text || 'Localização compartilhada'}</span>
      </div>
    )
  }

  // ── Contato ────────────────────────────────────────────
  if (msg.mediaType === 'contact') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <IcoUser size={22}/>
        <span style={{ fontSize: 13 }}>{msg.text || 'Contato compartilhado'}</span>
      </div>
    )
  }

  return null
}

// ── Componente principal ─────────────────────────────────────

export default function WorkspacePage() {
  const { data: session } = useSession()
  const handoff = useHandoff()

  const [chats, setChats]         = useState<ChatContact[]>([])
  const [selected, setSelected]   = useState<ChatContact | null>(null)
  const [messages, setMessages]   = useState<ChatMessage[]>([])
  const [input, setInput]         = useState('')
  const [search, setSearch]       = useState('')
  const [loading, setLoading]     = useState(true)
  const [loadingMsg, setLoadingMsg] = useState(false)
  const [sending, setSending]     = useState(false)
  const [toast, setToast]         = useState('')
  const [blModal, setBlModal]         = useState<ChatContact | null>(null)
  const [iaModal, setIaModal]         = useState<ChatContact | null>(null)
  const [profileModal, setProfileModal] = useState<ChatContact | null>(null)
  const [chatFilter, setChatFilter]   = useState<'todos'|'ia'|'humano'|'aberto'|'finalizado'>('todos')
  const [profilePic, setProfilePic]     = useState<string | null>(null)
  const [showAttach, setShowAttach] = useState(false)
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list')
  const tpl = useTemplates()

  const endRef          = useRef<HTMLDivElement>(null)
  const msgContainerRef = useRef<HTMLDivElement>(null)
  const isAtBottom      = useRef(true)
  const selectedRef     = useRef<ChatContact | null>(null)
  const fileInputRef    = useRef<HTMLInputElement>(null)
  const lastBackMs  = useRef(0)

  useEffect(() => { selectedRef.current = selected }, [selected])

  useEffect(() => {
    if (mobileView === 'chat') {
      document.body.classList.add('mobile-chat-open')
    } else {
      document.body.classList.remove('mobile-chat-open')
    }
    return () => { document.body.classList.remove('mobile-chat-open') }
  }, [mobileView])

  // Botão nativo voltar (Android/PWA): 1 clique → lista, 2 cliques rápidos → comportamento padrão
  useEffect(() => {
    if (mobileView !== 'chat') return

    window.history.pushState({ mobileChat: true }, '')

    const onPopState = (e: PopStateEvent) => {
      const now = Date.now()
      const gap = now - lastBackMs.current
      lastBackMs.current = now

      if (gap > 0 && gap < 400) {
        // Duplo clique rápido — deixa o browser agir normalmente
        return
      }

      // Clique único — intercepta e volta para a lista
      e.preventDefault?.()
      window.history.pushState({ mobileChat: true }, '')
      setMobileView('list')
    }

    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [mobileView])

  function showToast(m: string) { setToast(m); setTimeout(() => setToast(''), 3500) }

 // ── Fetch chats ────────────────────────────────────────────

  const fetchChats = useCallback(async () => {
    try {
      const r = await fetch('/api/evolution/chats', { cache: 'no-store' })
      const d = await r.json()
      if (d.success && d.data) setChats(d.data)
    } catch {} finally { setLoading(false) }
  }, [])

  // Inicia o polling de chats
  useEffect(() => {
    fetchChats()
    const i = setInterval(fetchChats, CHAT_POLL)
    return () => clearInterval(i)
  }, [fetchChats])

  // ── Fetch messages ─────────────────────────────────────────

  const fetchMessages = useCallback(async (phone: string, lidJid?: string | null) => {
    try {
      const lid = lidJid ? `&lid=${encodeURIComponent(lidJid)}` : ''
      const r = await fetch(`/api/evolution/messages?phone=${phone}&count=80${lid}`, { cache: 'no-store' })
      const d = await r.json()
      if (d.success && d.data) setMessages(d.data)
    } catch {} finally { setLoadingMsg(false) }
  }, [])

  useEffect(() => {
    if (!selected) return
    const i = setInterval(() => { if (selectedRef.current) fetchMessages(selectedRef.current.telefone, selectedRef.current.lidJid) }, MSG_POLL)
    return () => clearInterval(i)
  }, [selected, fetchMessages])

  useEffect(() => {
    if (isAtBottom.current) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  function openChat(c: ChatContact) {
    isAtBottom.current = true  // novo chat sempre começa no final
    setSelected(c)
    setMessages([])
    setLoadingMsg(true)
    fetchMessages(c.telefone, c.lidJid)
    setMobileView('chat')
    // Reseta o badge imediatamente no estado local
    setChats(prev => prev.map(x => x.telefone === c.telefone ? { ...x, unreadCount: 0 } : x))
    // Marca mensagens como lidas na Evolution API em background
    fetch(`/api/evolution/mark-read?phone=${encodeURIComponent(c.telefone)}${c.lidJid ? `&lid=${encodeURIComponent(c.lidJid)}` : ''}`, { method: 'POST' }).catch(() => {})
  }
  function backToList() { setMobileView('list') }

  async function openProfile(c: ChatContact) {
    setProfileModal(c)
    setProfilePic(c.profilePicUrl ?? null)
    if (!c.profilePicUrl) {
      try {
        const r = await fetch(`/api/evolution/profile-pic?number=${encodeURIComponent(c.telefone)}`)
        const d = await r.json()
        if (d.url) setProfilePic(d.url)
      } catch {}
    }
  }
  // ── Toggle IA ──────────────────────────────────────────────

  async function toggleIA(phone: string) {
    const c = chats.find(x => x.telefone === phone); if (!c) return
    const on = c.iaStatus === 'ativo'
    const res = on ? await handoff.pausar(phone) : await handoff.retomar(phone)
    if (!res.success) { showToast('Erro: ' + res.error); return }
    const ns = on ? 'pausado' : 'ativo'
    setChats(prev => prev.map(x => x.telefone === phone ? { ...x, iaStatus: ns } : x))
    if (selected?.telefone === phone) setSelected(s => s ? { ...s, iaStatus: ns } : s)
    showToast(on ? '⏸ IA pausada' : '▶ IA reativada')
  }

  // ── Enviar texto ───────────────────────────────────────────

  async function sendMsg() {
    if (!input.trim() || !selected || sending) return
    const text = input.trim()
    setSending(true)
    try {
      const r = await fetch('/api/evolution/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: selected.telefone, text, withTyping: true }),
      })
      const d = await r.json()
      if (d.success) {
        const now = new Date()
        setMessages(prev => [...prev, {
          id: `local_${Date.now()}`, remoteJid: '', type: 'outgoing', text,
          time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          timestamp: now.toISOString(), pushName: session?.user?.name ?? 'Atendente',
          fromMe: true, mediaType: null, mimetype: null, caption: null,
          duration: null, fileName: null, isPtt: false, status: null,
        }])
        setInput(''); showToast('✓ Mensagem enviada')
      } else showToast('Erro: ' + d.error)
    } catch { showToast('Erro de conexão') } finally { setSending(false) }
  }

  // ── Enviar mídia (Fase 2) ──────────────────────────────────

  async function sendFile(file: File) {
    if (!selected) return
    setSending(true)
    setShowAttach(false)

    try {
      // Converter para base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1]) // Remove o prefixo data:...;base64,
        }
        reader.onerror = () => reject(new Error('Erro ao ler arquivo'))
        reader.readAsDataURL(file)
      })

      // Detectar tipo de mídia
      let mediatype: 'image' | 'document' | 'audio' | 'video' = 'document'
      if (file.type.startsWith('image/')) mediatype = 'image'
      else if (file.type.startsWith('audio/')) mediatype = 'audio'
      else if (file.type.startsWith('video/')) mediatype = 'video'

      const r = await fetch('/api/evolution/send-media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: selected.telefone,
          media: base64,
          mediatype,
          mimetype: file.type,
          fileName: file.name,
          caption: mediatype === 'image' ? '' : undefined,
        }),
      })
      const d = await r.json()
      if (d.success) {
        showToast(`✓ ${mediatype === 'image' ? 'Imagem' : mediatype === 'audio' ? 'Áudio' : mediatype === 'video' ? 'Vídeo' : 'Arquivo'} enviado`)
        // Recarrega mensagens para mostrar a mídia enviada
        setTimeout(() => fetchMessages(selected.telefone, selected.lidJid), 2000)
      } else showToast('Erro: ' + d.error)
    } catch (err) {
      showToast('Erro ao enviar arquivo')
      console.error(err)
    } finally { setSending(false) }
  }

  // ── Blacklist ──────────────────────────────────────────────

  async function confirmBl() {
    if (!blModal) return
    try {
      const r = await fetch('/api/blacklist', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefone: blModal.telefone, motivo: 'Bloqueado pelo atendente' }),
      })
      const d = await r.json()
      setBlModal(null); showToast(d.success ? '🚫 Bloqueado' : 'Erro: ' + d.error); fetchChats()
    } catch { setBlModal(null); showToast('Erro ao bloquear') }
  }

  // ── Filtro ─────────────────────────────────────────────────

  const filteredChats = chats.filter(c => {
    const matchSearch = !search || c.nome.toLowerCase().includes(search.toLowerCase()) || c.telefone.includes(search)
    const matchFilter =
      chatFilter === 'todos'      ? true :
      chatFilter === 'ia'         ? c.iaStatus === 'ativo' :
      chatFilter === 'humano'     ? c.iaStatus === 'pausado' :
      chatFilter === 'aberto'     ? true :
      chatFilter === 'finalizado' ? false : true
    return matchSearch && matchFilter
  })

  const iaOn = (c: ChatContact) => c.iaStatus === 'ativo'

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="flex h-full" data-mobile-view={mobileView}>
      {/* Input de arquivo oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
        style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) sendFile(f); e.target.value = '' }}
      />

      {/* ── Sidebar de Chats ─────────────────────────────────── */}
      <aside className="workspace-list-panel w-[310px] border-r flex flex-col flex-shrink-0 overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <div className="px-3 py-2.5 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] font-semibold">Conversas</span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--neon)', color: '#0a0a0a' }}>{chats.length}</span>
              <button onClick={fetchChats} className="text-[11px] px-2 py-0.5 rounded border border-transparent hover:border-neon text-muted hover:text-neon transition-all" title="Atualizar">↻</button>
            </div>
          </div>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou número..."
            className="w-full px-3 py-1.5 text-[12px] rounded-lg" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }} />

          {/* Filtros estilo WhatsApp */}
          <div className="flex gap-1.5 mt-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
            {([
              { key: 'todos',      label: 'Todos' },
              { key: 'ia',         label: 'IA' },
              { key: 'humano',     label: 'Humano' },
              { key: 'aberto',     label: 'Em Aberto' },
              { key: 'finalizado', label: 'Finalizado' },
            ] as const).map(f => (
              <button key={f.key} onClick={() => setChatFilter(f.key)}
                className="flex-shrink-0 px-3 py-1 rounded-full text-[12px] font-medium transition-all"
                style={{
                  background: chatFilter === f.key ? 'var(--neon)' : 'var(--bg-input)',
                  color:      chatFilter === f.key ? '#0a0a0a'     : 'var(--txt-2)',
                  border:     chatFilter === f.key ? 'none'        : '1px solid var(--border)',
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? <div className="flex items-center justify-center py-12 text-[13px] text-muted">Carregando...</div>
          : filteredChats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[13px] text-muted gap-2">
              <span className="text-2xl">📭</span>
              <span>{search ? 'Nenhum resultado' : chatFilter === 'finalizado' ? 'Nenhuma conversa finalizada' : chatFilter === 'ia' ? 'Nenhuma conversa com IA ativa' : chatFilter === 'humano' ? 'Nenhuma conversa em atendimento humano' : 'Nenhuma conversa'}</span>
            </div>
          ) : filteredChats.map(c => {
            const isSel = selected?.telefone === c.telefone
            return (
              <div key={c.telefone} onClick={() => openChat(c)}
                className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer transition-all border-b"
                style={{ borderColor: 'var(--border)', background: isSel ? 'rgba(163,230,53,0.08)' : 'transparent' }}
                onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = 'var(--bg-hover)' }}
                onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = 'transparent' }}>
                <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-[12px] font-semibold"
                  style={{ background: iaOn(c) ? 'rgba(163,230,53,0.15)' : 'var(--bg-input)', color: iaOn(c) ? 'var(--neon)' : 'var(--txt-2)', border: `1px solid ${iaOn(c) ? 'rgba(163,230,53,0.3)' : 'var(--border-md)'}` }}>
                  {ini(c.nome)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--txt)' }}>{c.nome}</p>
                    <span className="text-[10px] flex-shrink-0 ml-2" style={{ color: 'var(--txt-2)' }}>{timeAgo(c.timestamp)}</span>
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-[11px] truncate pr-2" style={{ color: 'var(--txt-2)' }}>{c.preview || 'Sem mensagens'}</p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {c.unreadCount > 0 && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--neon)', color: '#0a0a0a' }}>{c.unreadCount}</span>}
                      <div className="w-2 h-2 rounded-full" style={{ background: iaOn(c) ? 'var(--neon)' : '#EF4444' }} title={iaOn(c) ? 'IA Ativa' : 'IA Pausada'} />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </aside>

      {/* ── Área de Chat ──────────────────────────────────────── */}
      <div className="workspace-chat-panel flex-1 flex flex-col overflow-hidden">
        {selected ? (<>
          {/* Header */}
          <div className="px-4 py-2.5 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <button className="mobile-back-btn" onClick={backToList}
                style={{ display: 'none', background: 'rgba(163,230,53,0.12)', border: '1px solid rgba(163,230,53,0.3)', cursor: 'pointer', color: 'var(--neon)', padding: '0', width: 34, height: 34, borderRadius: '50%', alignItems: 'center', justifyContent: 'center', fontSize: 20, lineHeight: 1, flexShrink: 0 }}>
                ‹
              </button>
              <div className="chat-header-avatar w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-semibold"
                onClick={() => openProfile(selected)}
                style={{ background: 'rgba(163,230,53,0.12)', color: 'var(--neon)', border: '1px solid rgba(163,230,53,0.25)', cursor: 'pointer' }}>
                {ini(selected.nome)}
              </div>
              <div style={{ minWidth: 0 }}>
                <p className="text-[14px] font-semibold truncate" style={{ color: 'var(--txt)' }}>{selected.nome}</p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="chat-header-phone text-[10px] text-muted font-mono">{fmtPhone(selected.telefone)}</span>
                  <div className="flex items-center gap-1 text-[11px]" style={{ color: iaOn(selected) ? 'var(--neon)' : '#EF4444' }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: iaOn(selected) ? 'var(--neon)' : '#EF4444' }} />
                    {iaOn(selected) ? 'IA Ativa' : 'Humano'}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => setIaModal(selected)} disabled={handoff.loading}
                className="chat-header-ia-btn px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all flex items-center gap-1"
                style={iaOn(selected)
                  ? { background: 'var(--danger)', color: '#fff', border: 'none' }
                  : { background: 'var(--neon)', color: '#0a0a0a', border: 'none' }}>
                <span>{iaOn(selected) ? '👤' : '🤖'}</span>
                <span className="chat-header-ia-txt">{iaOn(selected) ? 'Humano' : 'Ativar IA'}</span>
              </button>
              <button onClick={() => setBlModal(selected)}
                className="px-2 py-1.5 rounded-lg text-[12px] font-medium border transition-all"
                style={{ borderColor: 'rgba(239,68,68,0.4)', color: '#EF4444', background: 'rgba(239,68,68,0.08)' }}
                title="Blacklist"><IcoBan size={14}/></button>
              <button onClick={() => fetchMessages(selected.telefone, selected.lidJid)} className="chat-header-refresh px-2 py-1.5 rounded-lg text-[12px] border border-transparent hover:border-neon text-muted hover:text-neon transition-all" title="Atualizar">↻</button>
            </div>
          </div>

          {/* Mensagens */}
          <div
            ref={msgContainerRef}
            onScroll={() => {
              const el = msgContainerRef.current
              if (!el) return
              isAtBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
            }}
            className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-1.5"
            style={{ background: 'var(--wa-bg)' }}
          >
            {loadingMsg ? <div className="flex-1 flex items-center justify-center text-[13px] text-muted">Carregando mensagens...</div>
            : messages.length === 0 ? (
              <div className="flex-1 flex items-center justify-center flex-col gap-2 text-muted">
                <IcoMessageCircle size={24}/><p className="text-[13px]">Nenhuma mensagem encontrada</p>
              </div>
            ) : messages.map(msg => {
              const isOut = msg.type === 'outgoing'
              const hasMedia = msg.mediaType && msg.mediaType !== 'location' && msg.mediaType !== 'contact'
              const hasText = msg.text && !hasMedia // Texto puro (sem mídia que já mostra o texto como caption)

              return (
                <div key={msg.id} className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}>
                  <div style={{ maxWidth: '65%' }}>
                    <div className="px-3 py-2 rounded-xl text-[13px] leading-relaxed"
                      style={isOut
                        ? { background: 'var(--neon)', color: '#0a0a0a', fontWeight: 500, borderBottomRightRadius: 4 }
                        : { background: 'var(--wa-bubble-in)', color: 'var(--wa-txt)', borderBottomLeftRadius: 4 }}>

                      {/* Renderiza mídia */}
                      {msg.mediaType && <MediaBubble msg={{...msg, remoteJid: msg.remoteJid.endsWith('@lid') ? (selected?.telefone + '@s.whatsapp.net') : msg.remoteJid}} />}

                      {/* Texto (se não tem mídia, ou se mídia é location/contact que já mostra texto no componente) */}
                      {hasText && !msg.mediaType && <span>{msg.text}</span>}
                    </div>
                    <p className={`text-[9px] text-muted mt-0.5 px-1 ${isOut ? 'text-right' : ''}`}>
                      {msg.time}
                      {isOut && msg.status === 'READ' && ' ✓✓'}
                      {isOut && msg.status === 'DELIVERY_ACK' && ' ✓✓'}
                      {isOut && msg.status === 'SERVER_ACK' && ' ✓'}
                    </p>
                  </div>
                </div>
              )
            })}
            <div ref={endRef} />
          </div>

          {/* Input + Anexo */}
          <div className="px-4 py-3 border-t flex gap-2 items-end flex-shrink-0 workspace-input-bar" style={{ borderColor: 'var(--border)', background: 'var(--bg-sidebar)' }}>
            {/* Botão de anexo */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowAttach(!showAttach)}
                className="w-10 h-10 rounded-xl flex items-center justify-center text-[18px] transition-all flex-shrink-0"
                style={{ background: showAttach ? 'rgba(163,230,53,0.15)' : 'var(--bg-input)', border: `1px solid ${showAttach ? 'rgba(163,230,53,0.3)' : 'var(--border)'}`, color: showAttach ? 'var(--neon)' : 'var(--txt-2)' }}>
                +
              </button>
              {showAttach && (
                <div style={{
                  position: 'absolute', bottom: 50, left: 0, borderRadius: 12, padding: 8, minWidth: 160,
                  background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
                }}>
                  {[
                    { icon: '📷', label: 'Imagem', accept: 'image/*' },
                    { icon: '🎵', label: 'Áudio', accept: 'audio/*' },
                    { icon: '🎬', label: 'Vídeo', accept: 'video/*' },
                    { icon: '📄', label: 'Documento', accept: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip' },
                  ].map(item => (
                    <button key={item.label} onClick={() => {
                      if (fileInputRef.current) { fileInputRef.current.accept = item.accept; fileInputRef.current.click() }
                    }}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-[13px] transition-all"
                      style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--txt)' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                      <span>{item.icon}</span><span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ flex: 1, position: 'relative' }}>
              {tpl.showMenu && tpl.filtered.length > 0 && (
                <TemplateMenu
                  templates={tpl.filtered}
                  selectedIdx={tpl.selectedIdx}
                  onSelect={(t) => { setInput(tpl.selectTemplate(t, input)) }}
                  onClose={tpl.closeMenu}
                />
              )}
              <textarea value={input}
                onChange={e => { setInput(e.target.value); tpl.handleInputChange(e.target.value) }}
                onKeyDown={e => {
                  const handled = tpl.handleKeyDown(e, (newText) => setInput(newText), input)
                  if (handled) return
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg() }
                }}
                placeholder="Digite / para respostas rápidas..."
                rows={1} className="flex-1 px-3.5 py-2.5 text-[13px] resize-none rounded-xl"
                style={{ width: '100%', minHeight: 42, maxHeight: 120, background: 'var(--bg-input)', border: '1px solid var(--border)' }} />
            </div>

            <button onClick={sendMsg} disabled={sending || !input.trim()}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-[16px] transition-all hover:scale-105 flex-shrink-0 disabled:opacity-40"
              style={{ background: 'var(--neon)', color: '#0a0a0a' }}>
              {sending ? '...' : '→'}
            </button>
          </div>
        </>) : (
          <div className="flex-1 flex items-center justify-center flex-col gap-3 text-muted">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(163,230,53,0.08)', border: '1px solid rgba(163,230,53,0.15)', color: 'var(--neon)' }}><IcoMessageCircle size={32}/></div>
            <p className="text-[14px] font-medium" style={{ color: 'var(--txt)' }}>ComAgente Workspace</p>
            <p className="text-[12px] text-center max-w-[280px]">Selecione uma conversa para começar. As conversas atualizam automaticamente.</p>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--neon)' }} /><span className="text-[11px]">IA Ativa</span>
              <span className="w-2 h-2 rounded-full ml-3" style={{ background: '#EF4444' }} /><span className="text-[11px]">Humano</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Modal Perfil do Cliente ───────────────────────────── */}
      {profileModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setProfileModal(null) }}>
          <div className="rounded-2xl w-full max-w-[320px] overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>

            {/* Topo — foto real ou iniciais ocupando todo o quadrado */}
            <div style={{ position: 'relative', height: 180, borderBottom: '1px solid var(--border)', flexShrink: 0, overflow: 'hidden', background: 'rgba(163,230,53,0.15)' }}>
              {profilePic
                ? <img src={profilePic} alt={profileModal.nome} onError={() => setProfilePic(null)}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72, fontWeight: 700, color: 'var(--neon)' }}>
                    {ini(profileModal.nome)}
                  </div>
              }
            </div>

            {/* Informações */}
            <div style={{ padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--txt-2)', marginBottom: 3 }}>Nome</p>
                <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--txt)' }}>{profileModal.nome || '—'}</p>
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--txt-2)', marginBottom: 3 }}>Telefone</p>
                <p style={{ fontSize: 13, color: 'var(--txt)', fontFamily: 'monospace' }}>{fmtPhone(profileModal.telefone)}</p>
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--txt-2)', marginBottom: 3 }}>Última mensagem</p>
                <p style={{ fontSize: 13, color: 'var(--txt)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{profileModal.preview || '—'}</p>
              </div>
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--txt-2)', marginBottom: 3 }}>Tipo de atendimento</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: iaOn(profileModal) ? 'var(--neon)' : '#EF4444', display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: iaOn(profileModal) ? 'var(--neon)' : '#EF4444' }}>
                    {iaOn(profileModal) ? 'IA' : 'Humano'}
                  </span>
                </div>
              </div>
            </div>

            {/* Rodapé */}
            <div style={{ padding: '12px 24px 20px', display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setProfileModal(null)}
                className="px-4 py-2 rounded-lg text-[13px] border"
                style={{ borderColor: 'var(--border)', color: 'var(--txt-2)', background: 'transparent', cursor: 'pointer' }}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal IA Toggle ───────────────────────────────────── */}
      {iaModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }} onClick={e => { if (e.target === e.currentTarget) setIaModal(null) }}>
          <div className="rounded-xl p-6 max-w-[380px] w-full" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h3 className="text-[16px] font-semibold mb-2" style={{ color: 'var(--txt)' }}>
              {iaOn(iaModal) ? '⏸ Pausar IA' : '▶ Retomar IA'}
            </h3>
            <p className="text-[13px] mb-5" style={{ color: 'var(--text-secondary)' }}>
              {iaOn(iaModal)
                ? <>Pausar a IA para <strong style={{ color: 'var(--txt)' }}>{iaModal.nome || fmtPhone(iaModal.telefone)}</strong>? O atendimento passará para humano.</>
                : <>Retomar a IA para <strong style={{ color: 'var(--txt)' }}>{iaModal.nome || fmtPhone(iaModal.telefone)}</strong>? A IA voltará a responder automaticamente.</>
              }
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setIaModal(null)} className="px-4 py-2 rounded-lg text-[13px] border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Cancelar</button>
              <button onClick={() => { toggleIA(iaModal.telefone); setIaModal(null) }}
                className="px-4 py-2 rounded-lg text-[13px] font-semibold"
                style={{ background: iaOn(iaModal) ? '#EF4444' : 'var(--neon)', color: iaOn(iaModal) ? '#fff' : '#0a0a0a' }}>
                {iaOn(iaModal) ? 'Pausar' : 'Retomar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Blacklist ────────────────────────────────────── */}
      {blModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }} onClick={e => { if (e.target === e.currentTarget) setBlModal(null) }}>
          <div className="rounded-xl p-6 max-w-[380px] w-full" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h3 className="text-[16px] font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--txt)' }}><IcoBan size={16}/> Blacklist</h3>
            <p className="text-[13px] mb-5" style={{ color: 'var(--text-secondary)' }}>Bloquear <strong style={{ color: 'var(--txt)' }}>{blModal.nome}</strong> ({fmtPhone(blModal.telefone)})?</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setBlModal(null)} className="px-4 py-2 rounded-lg text-[13px] border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>Cancelar</button>
              <button onClick={confirmBl} className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white" style={{ background: '#EF4444' }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ─────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full text-[13px] font-medium z-[200]"
          style={{ background: 'var(--bg-card)', border: '1px solid rgba(163,230,53,0.3)', color: 'var(--neon)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
