// ─────────────────────────────────────────────────────────────
// lib/evolution/conversation-context.ts
// FASE 8 — Serviço de contexto de conversa.
//
// Busca as últimas N mensagens da Evolution API e monta um
// resumo estruturado para enviar ao n8n/Gemini como contexto.
// Também detecta intenção do cliente para classificação no CRM.
// ─────────────────────────────────────────────────────────────

import { EvolutionClient, numberToJid } from './client'

// ── Tipos ────────────────────────────────────────────────────

export interface ConversationMessage {
  role:      'cliente' | 'bot' | 'atendente'
  text:      string
  timestamp: string
}

export interface ConversationContext {
  messages:        ConversationMessage[]
  resumo:          string
  totalMensagens:  number
  primeiroContato: string
  ultimoContato:   string
  temMidia:        boolean
  intencaoDetectada: string | null
}

// ── Palavras-chave para detecção de intenção ─────────────────

const INTENCOES: Record<string, string[]> = {
  'compra':       ['comprar', 'preço', 'valor', 'quanto custa', 'orçamento', 'cotação', 'plano', 'pacote', 'promoção', 'desconto'],
  'suporte':      ['problema', 'erro', 'não funciona', 'bug', 'ajuda', 'suporte', 'defeito', 'quebrou', 'parou'],
  'cancelamento': ['cancelar', 'cancela', 'desistir', 'reembolso', 'devolver', 'não quero mais'],
  'informacao':   ['como funciona', 'informação', 'dúvida', 'horário', 'endereço', 'localização', 'onde fica'],
  'agendamento':  ['agendar', 'marcar', 'horário disponível', 'agenda', 'consulta', 'visita'],
  'reclamacao':   ['reclamação', 'insatisfeito', 'péssimo', 'horrível', 'absurdo', 'vergonha', 'denúncia'],
  'elogio':       ['parabéns', 'excelente', 'ótimo', 'maravilhoso', 'muito bom', 'adorei', 'recomendo'],
}

function detectarIntencao(mensagens: ConversationMessage[]): string | null {
  // Analisa as últimas 5 mensagens do cliente
  const clientMsgs = mensagens
    .filter(m => m.role === 'cliente')
    .slice(-5)
    .map(m => m.text.toLowerCase())
    .join(' ')

  if (!clientMsgs) return null

  let melhorIntencao: string | null = null
  let melhorScore = 0

  for (const [intencao, palavras] of Object.entries(INTENCOES)) {
    let score = 0
    for (const palavra of palavras) {
      if (clientMsgs.includes(palavra)) score++
    }
    if (score > melhorScore) {
      melhorScore = score
      melhorIntencao = intencao
    }
  }

  return melhorScore >= 1 ? melhorIntencao : null
}

// ── Extrai texto de mensagem da Evolution API ────────────────

function extractText(message?: Record<string, unknown>): string {
  if (!message) return ''
  if (typeof message.conversation === 'string') return message.conversation
  const ext = message.extendedTextMessage as Record<string, unknown> | undefined
  if (ext && typeof ext.text === 'string') return ext.text
  const img = message.imageMessage as Record<string, unknown> | undefined
  if (img) return (img.caption as string) ?? '[imagem]'
  const aud = message.audioMessage as Record<string, unknown> | undefined
  if (aud) return '[áudio]'
  const vid = message.videoMessage as Record<string, unknown> | undefined
  if (vid) return (vid.caption as string) ?? '[vídeo]'
  const doc = message.documentMessage as Record<string, unknown> | undefined
  if (doc) return `[documento: ${(doc.title as string) ?? 'arquivo'}]`
  if (message.locationMessage) return '[localização]'
  if (message.contactMessage) return '[contato]'
  return ''
}

// ── Serviço principal ────────────────────────────────────────

export class ConversationContextService {
  private client: EvolutionClient

  constructor(instanceName: string) {
    this.client = EvolutionClient.fromEnv(instanceName)
  }

  /**
   * Busca o contexto completo de uma conversa para enviar ao n8n/Gemini.
   * @param phone - Número do cliente (formato 5571999999999)
   * @param maxMessages - Quantidade máxima de mensagens no contexto (padrão: 20)
   */
  async getContext(phone: string, maxMessages = 20): Promise<ConversationContext> {
    const jid = numberToJid(phone)

    let rawMessages: Array<{
      key: { id: string; fromMe: boolean; remoteJid: string }
      pushName?: string
      message?: Record<string, unknown>
      messageTimestamp?: number | string
    }> = []

    try {
      rawMessages = await this.client.findMessages(jid, maxMessages + 10) // Pega extras para filtrar
    } catch (err) {
      console.error(`[Context] Erro ao buscar mensagens de ${phone}:`, err)
      return {
        messages: [],
        resumo: '',
        totalMensagens: 0,
        primeiroContato: '',
        ultimoContato: '',
        temMidia: false,
        intencaoDetectada: null,
      }
    }

    // Filtra e formata mensagens
    const messages: ConversationMessage[] = rawMessages
      .filter(msg => {
        if (!msg.message) return false
        const m = msg.message as Record<string, unknown>
        if (m.reactionMessage || m.protocolMessage) return false
        return true
      })
      .map(msg => {
        const text = extractText(msg.message as Record<string, unknown>)
        const ts = msg.messageTimestamp
          ? new Date(Number(msg.messageTimestamp) * 1000).toISOString()
          : new Date().toISOString()

        // Determina o role: fromMe = bot ou atendente, !fromMe = cliente
        // Não temos como diferenciar bot de atendente aqui, então usamos 'bot'
        // O n8n pode refinar isso com base no contexto
        const role: ConversationMessage['role'] = msg.key.fromMe ? 'bot' : 'cliente'

        return { role, text, timestamp: ts }
      })
      .filter(m => m.text !== '')
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .slice(-maxMessages)

    // Detecta se tem mídia
    const temMidia = rawMessages.some(msg => {
      const m = msg.message as Record<string, unknown> | undefined
      return m && (m.imageMessage || m.audioMessage || m.videoMessage || m.documentMessage)
    })

    // Detecta intenção
    const intencaoDetectada = detectarIntencao(messages)

    // Monta resumo estruturado para o prompt
    const resumo = this.montarResumo(messages)

    return {
      messages,
      resumo,
      totalMensagens: messages.length,
      primeiroContato: messages[0]?.timestamp ?? '',
      ultimoContato: messages[messages.length - 1]?.timestamp ?? '',
      temMidia,
      intencaoDetectada,
    }
  }

  /**
   * Monta um resumo da conversa formatado para injeção no prompt do Gemini.
   */
  private montarResumo(messages: ConversationMessage[]): string {
    if (messages.length === 0) return 'Primeiro contato do cliente. Sem histórico.'

    const lines: string[] = []
    lines.push(`Histórico da conversa (${messages.length} mensagens):`)
    lines.push('---')

    for (const msg of messages) {
      const time = msg.timestamp.slice(11, 16) // HH:MM
      const roleLabel = msg.role === 'cliente' ? 'CLIENTE' : msg.role === 'bot' ? 'VOCÊ' : 'ATENDENTE'
      // Trunca mensagens longas para economizar tokens
      const text = msg.text.length > 200 ? msg.text.slice(0, 200) + '...' : msg.text
      lines.push(`[${time}] ${roleLabel}: ${text}`)
    }

    lines.push('---')
    lines.push('Continue a conversa de forma natural, sem repetir perguntas já respondidas.')

    return lines.join('\n')
  }

  /**
   * Versão compacta do contexto para economizar tokens.
   * Envia apenas as últimas 5 mensagens em formato resumido.
   */
  async getCompactContext(phone: string): Promise<string> {
    const ctx = await this.getContext(phone, 8)

    if (ctx.messages.length === 0) {
      return 'Novo contato. Primeira mensagem.'
    }

    const last5 = ctx.messages.slice(-5)
    const lines = last5.map(m => {
      const role = m.role === 'cliente' ? 'C' : 'B'
      const text = m.text.length > 100 ? m.text.slice(0, 100) + '...' : m.text
      return `${role}: ${text}`
    })

    let result = lines.join('\n')
    if (ctx.intencaoDetectada) {
      result += `\n[Intenção detectada: ${ctx.intencaoDetectada}]`
    }

    return result
  }
}
