'use client'
// app/(app)/workspace/page.tsx
// Workspace de Chat — zona de handoff IA ↔ Humano

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useHandoff } from '@/lib/hooks/use-handoff'

interface QueueContact {
  id:        string
  name:      string
  initials:  string
  preview:   string
  time:      string
  sentiment: '😀' | '😡' | '😐'
  iaOn:      boolean
}

interface ChatMessage {
  type:    'bot' | 'human' | 'client'
  text:    string
  time:    string
}

// Dados iniciais — em produção vêm de polling ou WebSocket sobre o Sheets
const INITIAL_QUEUE: QueueContact[] = [
  { id: '557198001001', name: 'Carlos Mendes',  initials: 'CM', preview: 'Qual o preço do plano anual?', time: '2m', sentiment: '😀', iaOn: true  },
  { id: '557198002002', name: 'Fernanda Lima',  initials: 'FL', preview: 'Já fiz o pagamento!',          time: '5m', sentiment: '😀', iaOn: true  },
  { id: '557198003003', name: 'Roberto Alves',  initials: 'RA', preview: 'Isso é golpe?',               time: '8m', sentiment: '😡', iaOn: false },
  { id: '557198004004', name: 'Mariana Costa',  initials: 'MC', preview: 'Não recebi confirmação',      time: '12m',sentiment: '😀', iaOn: true  },
  { id: '557198005005', name: 'Diego Souza',    initials: 'DS', preview: 'Tenho uma frota de 12 veículos',time:'18m',sentiment: '😀', iaOn: false },
]

const MOCK_MESSAGES: Record<string, ChatMessage[]> = {
  '557198001001': [
    { type: 'client', text: 'Olá! Quero saber sobre o rastreamento.', time: '09:01' },
    { type: 'bot',    text: 'Oi Carlos! Sou a Ana Maria da TrackerMap. 😊 O rastreamento é para você ou sua empresa?', time: '09:01' },
    { type: 'client', text: 'Para mim, tenho 1 carro.', time: '09:02' },
    { type: 'bot',    text: 'Perfeito! O mais escolhido é o PREMIUM — R$ 49,90/mês com garantia vitalícia. Posso enviar os detalhes?', time: '09:02' },
    { type: 'client', text: 'Qual o preço do plano anual?', time: '09:04' },
  ],
  '557198003003': [
    { type: 'client', text: 'Quem é você?', time: '08:50' },
    { type: 'bot',    text: 'Olá! Sou a Ana Maria, assistente virtual da TrackerMap!', time: '08:50' },
    { type: 'client', text: 'Isso é golpe?', time: '08:51' },
    { type: 'human',  text: 'Olá Roberto, somos empresa legítima. Posso enviar nosso site e CNPJ para conferir. 🙂', time: '08:53' },
  ],
}

export default function WorkspacePage() {
  const { data: session } = useSession()
  const handoff = useHandoff()

  const [queue,           setQueue]           = useState<QueueContact[]>(INITIAL_QUEUE)
  const [selected,        setSelected]        = useState<QueueContact | null>(null)
  const [messages,        setMessages]        = useState<ChatMessage[]>([])
  const [inputText,       setInputText]       = useState('')
  const [blacklistModal,  setBlacklistModal]  = useState<QueueContact | null>(null)
  const [killModal,       setKillModal]       = useState(false)
  const [toast,           setToast]           = useState('')

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  function openChat(contact: QueueContact) {
    setSelected(contact)
    setMessages(MOCK_MESSAGES[contact.id] ?? [])
  }

  async function toggleIA(id: string) {
    const contact = queue.find(c => c.id === id)
    if (!contact) return

    const action = contact.iaOn ? 'pausar' : 'retomar'
    const res    = await (contact.iaOn
      ? handoff.pausar(id)
      : handoff.retomar(id))

    if (!res.success) { showToast(`Erro: ${res.error}`); return }

    setQueue(q => q.map(c => c.id === id ? { ...c, iaOn: !c.iaOn } : c))
    if (selected?.id === id) setSelected(s => s ? { ...s, iaOn: !s.iaOn } : s)
    showToast(action === 'pausar' ? `IA pausada — gravado na Fila Humana` : `IA reativada`)
  }

  async function confirmKillSwitch() {
    const res = await handoff.killSwitch()
    if (!res.success) { showToast(`Erro: ${res.error}`); setKillModal(false); return }
    setQueue(q => q.map(c => ({ ...c, iaOn: false })))
    if (selected) setSelected(s => s ? { ...s, iaOn: false } : s)
    setKillModal(false)
    showToast('🛑 Kill Switch — IA pausada para TODOS (ALL gravado)')
  }

  async function confirmBlacklist() {
    if (!blacklistModal) return
    const res = await fetch('/api/blacklist', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ telefone: blacklistModal.id, motivo: 'Bloqueado pelo atendente' }),
    })
    const data = await res.json()
    setBlacklistModal(null)
    showToast(data.success ? `🚫 ${blacklistModal.name} bloqueado` : `Erro: ${data.error}`)
  }

  function sendMessage() {
    if (!inputText.trim() || !selected) return
    const msg: ChatMessage = {
      type: 'human',
      text: inputText.trim(),
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }
    setMessages(prev => [...prev, msg])
    setInputText('')
    showToast('Mensagem enviada')
  }

  const iaMacroLabel = (on: boolean) => on ? 'IA Ativa' : 'Atendimento Humano'

  return (
    <div className="flex h-full">

      {/* ── Queue ─────────────────────────────────────────────── */}
      <aside className="w-[290px] border-r flex flex-col flex-shrink-0 overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
          <span className="text-[13px] font-semibold">Fila de Atendimento</span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--neon)', color: '#0a0a0a' }}>
            {queue.length}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {queue.map(contact => (
            <div
              key={contact.id}
              onClick={() => openChat(contact)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all border ${
                selected?.id === contact.id
                  ? 'bg-neon-dim border-neon'
                  : 'border-transparent hover:bg-white/[0.03]'
              }`}
            >
              <div className="w-9 h-9 rounded-full flex-shrink-0 flex items-center justify-center text-[13px] font-semibold text-secondary-aad bg-input-aad">
                {contact.initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate">{contact.name}</p>
                <p className="text-[11px] text-muted truncate">{contact.preview}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <div className="flex items-center gap-1">
                  <span className="text-[14px]">{contact.sentiment}</span>
                  <button
                    onClick={e => { e.stopPropagation(); setBlacklistModal(contact) }}
                    className="text-[12px] opacity-30 hover:opacity-100 transition-opacity"
                    title="Blacklist"
                  >🚫</button>
                </div>
                <p className="text-[10px] text-muted">{contact.time}</p>
                <div
                  onClick={e => { e.stopPropagation(); toggleIA(contact.id) }}
                  className={`ia-toggle ${contact.iaOn ? 'ia-toggle-on' : 'ia-toggle-off'}`}
                  title={contact.iaOn ? 'Pausar IA' : 'Retomar IA'}
                />
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Chat ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selected ? (
          <>
            {/* Chat header */}
            <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-semibold text-neon"
                  style={{ background: 'var(--neon-dim)', border: '1px solid var(--border-neon)' }}>
                  {selected.initials}
                </div>
                <div>
                  <p className="text-[14px] font-semibold">{selected.name}</p>
                  <div className="flex items-center gap-1.5 text-[11px]" style={{ color: selected.iaOn ? 'var(--neon)' : 'var(--text-secondary)' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: selected.iaOn ? 'var(--neon)' : 'var(--text-secondary)' }} />
                    {iaMacroLabel(selected.iaOn)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleIA(selected.id)}
                  disabled={handoff.loading}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-medium border border-aad text-secondary-aad hover:border-neon hover:text-neon transition-all"
                >
                  {selected.iaOn ? '⏸ Pausar IA' : '▶ Retomar IA'}
                </button>
                <button
                  onClick={() => showToast('Atendimento finalizado')}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-medium border border-aad text-secondary-aad hover:border-neon hover:text-neon transition-all"
                >
                  ✓ Finalizar
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2.5">
              {messages.map((msg, i) => {
                const isHuman  = msg.type === 'human'
                const isClient = msg.type === 'client'
                return (
                  <div key={i} className={`flex ${isHuman ? 'justify-end' : 'justify-start'} max-w-[70%] ${isHuman ? 'self-end' : 'self-start'}`}>
                    <div>
                      <p className={`text-[10px] text-muted mb-1 ${isHuman ? 'text-right' : ''} px-1`}>
                        {msg.type === 'bot' ? '🤖 Ana Maria (IA)' : msg.type === 'human' ? '👤 Atendente' : '📱 Cliente'} · {msg.time}
                      </p>
                      <div
                        className="px-3.5 py-2.5 rounded-xl text-[13px] leading-relaxed"
                        style={isHuman
                          ? { background: 'var(--neon)', color: '#0a0a0a', fontWeight: 500, borderBottomRightRadius: 4 }
                          : { background: 'rgba(255,255,255,0.06)', borderBottomLeftRadius: 4 }
                        }
                      >
                        {msg.text}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t flex gap-2 items-end flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
              <textarea
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="Digite sua mensagem... (Enter para enviar)"
                rows={1}
                className="flex-1 px-3.5 py-2.5 text-[13px] resize-none"
                style={{ minHeight: 40, maxHeight: 100 }}
              />
              <button
                onClick={sendMessage}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-[16px] transition-all hover:scale-105 flex-shrink-0"
                style={{ background: 'var(--neon)', color: '#0a0a0a' }}
              >→</button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center flex-col gap-3 text-muted">
            <span className="text-4xl">💬</span>
            <p className="text-[13px]">Selecione um atendimento na fila</p>
          </div>
        )}
      </div>

      {/* ── Blacklist Modal ────────────────────────────────────── */}
      {blacklistModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-card-aad border border-aad rounded-xl p-6 max-w-[360px] w-full animate-slide-up">
            <h3 className="font-display text-[16px] font-semibold mb-2">🚫 Adicionar à Blacklist?</h3>
            <p className="text-[13px] text-secondary-aad mb-5 leading-relaxed">
              Tem certeza que deseja bloquear <strong className="text-white">{blacklistModal.name}</strong>?
              Esta ação será gravada na planilha Blacklist e o número não receberá mais mensagens do bot.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setBlacklistModal(null)} className="px-4 py-2 rounded-lg text-[13px] border border-aad text-secondary-aad hover:border-neon hover:text-neon transition-all">Cancelar</button>
              <button onClick={confirmBlacklist} className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white" style={{ background: 'var(--danger)' }}>Confirmar bloqueio</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Kill Switch Modal ──────────────────────────────────── */}
      {killModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-card-aad border border-aad rounded-xl p-6 max-w-[380px] w-full animate-slide-up">
            <h3 className="font-display text-[16px] font-semibold mb-2">🛑 Kill Switch Global</h3>
            <p className="text-[13px] text-secondary-aad mb-5 leading-relaxed">
              Esta ação vai pausar a IA em <strong className="text-white">TODOS os atendimentos</strong>.
              O registro será gravado com telefone <code className="text-neon">"ALL"</code> na aba Fila_Humana.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setKillModal(false)} className="px-4 py-2 rounded-lg text-[13px] border border-aad text-secondary-aad hover:border-neon hover:text-neon transition-all">Cancelar</button>
              <button onClick={confirmKillSwitch} disabled={handoff.loading} className="px-4 py-2 rounded-lg text-[13px] font-semibold text-white" style={{ background: 'var(--danger)' }}>
                {handoff.loading ? 'Pausando...' : 'Pausar toda a IA'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ─────────────────────────────────────────────── */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-full text-[13px] font-medium z-[200] animate-fade-in"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-neon)', color: 'var(--neon)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
