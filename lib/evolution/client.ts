// ─────────────────────────────────────────────────────────────
// lib/evolution/client.ts
//
// Cliente HTTP tipado para a Evolution API v2.
// FASE 2: Adicionado getMediaBase64 para download de mídia.
// ─────────────────────────────────────────────────────────────

export interface EvolutionConfig {
  baseUrl:      string
  apiKey:       string
  instanceName: string
}

// ── Tipos de payload ─────────────────────────────────────────

export interface SendTextPayload {
  number:  string
  text:    string
  delay?:  number
  quoted?: { key: { id: string } }
}

export interface SendMediaPayload {
  number:   string
  mediatype: 'image' | 'document' | 'audio' | 'video'
  mimetype:  string
  caption?:  string
  media:     string
  fileName?: string
}

export interface SendPresencePayload {
  number:   string
  presence: 'composing' | 'recording' | 'paused'
  delay?:   number
}

export interface QRCodeResponse {
  qrcode: { base64: string; code: string }
  instance: { instanceName: string; status: string }
}

export interface InstanceStatusResponse {
  instance: {
    instanceName: string
    state: 'open' | 'close' | 'connecting'
    profileName?: string
    profilePictureUrl?: string
    phoneNumber?: string
  }
}

export interface WebhookConfig {
  url:      string
  enabled:  boolean
  events:   string[]
}

// ── Tipos para Chat ──────────────────────────────────────────

export interface EvolutionChat {
  id:            string
  remoteJid:     string
  pushName?:     string
  profilePicUrl?: string
  lastMessage?:  {
    key:          { id: string; fromMe: boolean; remoteJid: string }
    message?:     Record<string, unknown>
    messageTimestamp?: number
    pushName?:    string
  }
  updatedAt?:    string
  unreadCount?:  number
}

export interface EvolutionMessage {
  key: {
    id:        string
    fromMe:    boolean
    remoteJid: string
  }
  pushName?:        string
  message?:         Record<string, unknown>
  messageTimestamp?: number | string
  messageType?:     string
  status?:          string
}

// ── Cliente ───────────────────────────────────────────────────

export class EvolutionClient {
  private baseUrl:      string
  private apiKey:       string
  private instanceName: string

  constructor(config: EvolutionConfig) {
    this.baseUrl      = config.baseUrl.replace(/\/$/, '')
    this.apiKey       = config.apiKey
    this.instanceName = config.instanceName
  }

  static fromEnv(instanceName: string): EvolutionClient {
    const baseUrl = process.env.EVOLUTION_API_URL
    const apiKey  = process.env.EVOLUTION_API_KEY
    if (!baseUrl || !apiKey) {
      throw new Error('[Evolution] EVOLUTION_API_URL ou EVOLUTION_API_KEY não configurados.')
    }
    return new EvolutionClient({ baseUrl, apiKey, instanceName })
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    path:   string,
    body?:  unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': this.apiKey,
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: 'no-store',
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`[Evolution] ${method} ${path} → ${res.status}: ${text}`)
    }

    return res.json() as Promise<T>
  }

  // ════════════════════════════════════════════════════════════
  // INSTÂNCIA
  // ════════════════════════════════════════════════════════════

  async getStatus(): Promise<InstanceStatusResponse> {
    return this.request<InstanceStatusResponse>('GET', `/instance/connectionState/${this.instanceName}`)
  }

  async getQRCode(): Promise<QRCodeResponse> {
    const raw = await this.request<Record<string, unknown>>('GET', `/instance/connect/${this.instanceName}`)
    // Evolution API v2 pode retornar { base64, code } direto ou { qrcode: { base64, code } }
    const nested = raw.qrcode as Record<string, unknown> | undefined
    const base64 = (nested?.base64 ?? raw.base64 ?? '') as string
    const code   = (nested?.code   ?? raw.code   ?? '') as string
    return {
      qrcode:   { base64, code },
      instance: (raw.instance as QRCodeResponse['instance']) ?? { instanceName: this.instanceName, status: '' },
    }
  }

  async logout(): Promise<{ status: string }> {
    return this.request<{ status: string }>('DELETE', `/instance/logout/${this.instanceName}`)
  }

  async restart(): Promise<{ status: string }> {
    return this.request<{ status: string }>('PUT', `/instance/restart/${this.instanceName}`)
  }

  // ════════════════════════════════════════════════════════════
  // WEBHOOK
  // ════════════════════════════════════════════════════════════

  async setWebhook(config: WebhookConfig): Promise<void> {
    await this.request<unknown>('POST', `/webhook/set/${this.instanceName}`, {
      webhook: { enabled: config.enabled, url: config.url, events: config.events, webhookByEvents: false, webhookBase64: false },
    })
  }

  async getWebhook(): Promise<{ webhook: WebhookConfig }> {
    return this.request<{ webhook: WebhookConfig }>('GET', `/webhook/find/${this.instanceName}`)
  }

  // ════════════════════════════════════════════════════════════
  // CHATS
  // ════════════════════════════════════════════════════════════

  async findChats(): Promise<EvolutionChat[]> {
    return this.request<EvolutionChat[]>('POST', `/chat/findChats/${this.instanceName}`, {})
  }

  async findMessages(remoteJid: string, count = 50): Promise<EvolutionMessage[]> {
    const result = await this.request<{ messages?: { records: EvolutionMessage[] } }>(
      'POST', `/chat/findMessages/${this.instanceName}`,
      { where: { key: { remoteJid } }, limit: count }
    )
    if (Array.isArray(result)) return result as unknown as EvolutionMessage[]
    if (result?.messages?.records) return result.messages.records
    return []
  }

  // Busca mensagens RECEBIDAS (fromMe=false) filtrando por remoteJidAlt.
  // Mensagens recebidas no WhatsApp moderno usam remoteJid=@lid e guardam
  // o telefone do contato em remoteJidAlt. Filtrar por remoteJidAlt retorna
  // todas as mensagens recebidas daquele número.
  // Envia confirmação de leitura ao remetente (double blue check no WhatsApp do cliente).
  async markMessagesAsRead(messages: Array<{ remoteJid: string; fromMe: boolean; id: string }>): Promise<void> {
    try {
      await this.request('POST', `/chat/markMessageAsRead/${this.instanceName}`, {
        readMessages: messages,
      })
    } catch {
      // Não crítico — se falhar, cliente simplesmente não vê o azul
    }
  }

  async findReceivedMessages(phoneJid: string, count = 50): Promise<EvolutionMessage[]> {
    try {
      const result = await this.request<{ messages?: { records: EvolutionMessage[] } }>(
        'POST', `/chat/findMessages/${this.instanceName}`,
        { where: { key: { remoteJidAlt: phoneJid } }, limit: count }
      )
      if (Array.isArray(result)) return result as unknown as EvolutionMessage[]
      if (result?.messages?.records) return result.messages.records
      return []
    } catch {
      return []
    }
  }

  // ════════════════════════════════════════════════════════════
  // MÍDIA — FASE 2 (NOVO)
  // ════════════════════════════════════════════════════════════

  /**
   * Baixa mídia de uma mensagem como base64.
   * Usa o endpoint /chat/getBase64FromMediaMessage da Evolution API.
   * @param messageId - ID da mensagem que contém a mídia
   * @param remoteJid - JID do contato
   */
  async getMediaBase64(messageId: string, remoteJid: string): Promise<{
    base64:   string
    mimetype: string
    fileName?: string
  }> {
    return this.request<{ base64: string; mimetype: string; fileName?: string }>(
      'POST', `/chat/getBase64FromMediaMessage/${this.instanceName}`,
      { message: { key: { id: messageId, remoteJid } } }
    )
  }

  // ════════════════════════════════════════════════════════════
  // MENSAGENS
  // ════════════════════════════════════════════════════════════

  async sendText(payload: SendTextPayload): Promise<{ key: { id: string } }> {
    return this.request('POST', `/message/sendText/${this.instanceName}`, payload)
  }

  async sendMedia(payload: SendMediaPayload): Promise<{ key: { id: string } }> {
    return this.request('POST', `/message/sendMedia/${this.instanceName}`, payload)
  }

  async sendPresence(payload: SendPresencePayload): Promise<void> {
    await this.request('POST', `/chat/sendPresence/${this.instanceName}`, payload)
  }

  async sendTextWithTyping(number: string, text: string): Promise<{ key: { id: string } }> {
    const typingMs = Math.min(Math.max(text.length * 40, 800), 4000)
    await this.sendPresence({ number, presence: 'composing', delay: typingMs })
    return this.sendText({ number, text, delay: typingMs })
  }

  // ════════════════════════════════════════════════════════════
  // PERFIL / CONTATO
  // ════════════════════════════════════════════════════════════

  async checkNumber(number: string): Promise<{ exists: boolean; jid: string }> {
    const res = await this.request<Array<{ exists: boolean; jid: string }>>(
      'POST', `/chat/whatsappNumbers/${this.instanceName}`, { numbers: [number] }
    )
    return res[0] ?? { exists: false, jid: '' }
  }

  async getContactInfo(number: string): Promise<{ name?: string; pushName?: string; profilePictureUrl?: string }> {
    const raw = await this.request<Record<string, unknown>>('POST', `/chat/fetchProfile/${this.instanceName}`, { number })
    // Evolution API pode retornar o campo com nomes diferentes dependendo da versão
    const pic = (raw.profilePictureUrl ?? raw.profilePicUrl ?? raw.picture ?? raw.profilePic ?? null) as string | null
    return { ...raw, profilePictureUrl: pic ?? undefined } as { name?: string; pushName?: string; profilePictureUrl?: string }
  }
}

// ── Helpers ──────────────────────────────────────────────────

export function normalizeNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('55')) return digits
  if (digits.startsWith('0')) return `55${digits.slice(1)}`
  return `55${digits}`
}

export function jidToNumber(jid: string): string {
  return jid.split('@')[0].split(':')[0]
}

export function numberToJid(number: string): string {
  const clean = normalizeNumber(number)
  return `${clean}@s.whatsapp.net`
}
