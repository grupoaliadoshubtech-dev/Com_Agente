// ─────────────────────────────────────────────────────────────
// lib/evolution/client.ts
//
// Cliente HTTP tipado para a Evolution API v2.
// Todas as chamadas passam por aqui — zero fetch espalhado.
//
// Variáveis de ambiente necessárias por tenant:
//   EVOLUTION_API_URL      → ex: https://agenciadia-evolution-api.nxwkfd.easypanel.host
//   EVOLUTION_API_KEY      → API key global (header apikey)
//
// Cada tenant tem sua própria instância WhatsApp (instance name).
// O instance name fica salvo na coluna evolutionInstance da aba Empresas.
// ─────────────────────────────────────────────────────────────

export interface EvolutionConfig {
  baseUrl:      string   // sem trailing slash
  apiKey:       string
  instanceName: string   // ex: "agenciadia"
}

// ── Tipos de payload ─────────────────────────────────────────

export interface SendTextPayload {
  number:  string          // formato: 557199999999 (sem +, sem @)
  text:    string
  delay?:  number          // ms antes de enviar (simula digitação)
  quoted?: { key: { id: string } }
}

export interface SendMediaPayload {
  number:   string
  mediatype: 'image' | 'document' | 'audio' | 'video'
  mimetype:  string
  caption?:  string
  media:     string        // URL pública ou base64
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

  // ── Fábrica estática (usa env vars) ────────────────────────
  static fromEnv(instanceName: string): EvolutionClient {
    const baseUrl = process.env.EVOLUTION_API_URL
    const apiKey  = process.env.EVOLUTION_API_KEY
    if (!baseUrl || !apiKey) {
      throw new Error('[Evolution] EVOLUTION_API_URL ou EVOLUTION_API_KEY não configurados.')
    }
    return new EvolutionClient({ baseUrl, apiKey, instanceName })
  }

  // ── HTTP helper ─────────────────────────────────────────────
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
      // Sem cache — dados em tempo real
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

  /** Status da conexão WhatsApp da instância. */
  async getStatus(): Promise<InstanceStatusResponse> {
    return this.request<InstanceStatusResponse>(
      'GET',
      `/instance/connectionState/${this.instanceName}`
    )
  }

  /** Gera QR Code para conectar via WhatsApp Web. */
  async getQRCode(): Promise<QRCodeResponse> {
    return this.request<QRCodeResponse>(
      'GET',
      `/instance/connect/${this.instanceName}`
    )
  }

  /** Desconecta (logout) da instância. */
  async logout(): Promise<{ status: string }> {
    return this.request<{ status: string }>(
      'DELETE',
      `/instance/logout/${this.instanceName}`
    )
  }

  /** Reinicia a instância. */
  async restart(): Promise<{ status: string }> {
    return this.request<{ status: string }>(
      'PUT',
      `/instance/restart/${this.instanceName}`
    )
  }

  // ════════════════════════════════════════════════════════════
  // WEBHOOK
  // ════════════════════════════════════════════════════════════

  /**
   * Configura o webhook da instância.
   * Chame durante provisionamento do tenant.
   */
  async setWebhook(config: WebhookConfig): Promise<void> {
    await this.request<unknown>(
      'POST',
      `/webhook/set/${this.instanceName}`,
      {
        webhook: {
          enabled: config.enabled,
          url:     config.url,
          events:  config.events,
          // Envia dados completos no body do webhook
          webhookByEvents: false,
          webhookBase64:   false,
        },
      }
    )
  }

  /** Lê a configuração atual do webhook. */
  async getWebhook(): Promise<{ webhook: WebhookConfig }> {
    return this.request<{ webhook: WebhookConfig }>(
      'GET',
      `/webhook/find/${this.instanceName}`
    )
  }

  // ════════════════════════════════════════════════════════════
  // MENSAGENS
  // ════════════════════════════════════════════════════════════

  /** Envia mensagem de texto. */
  async sendText(payload: SendTextPayload): Promise<{ key: { id: string } }> {
    return this.request(
      'POST',
      `/message/sendText/${this.instanceName}`,
      payload
    )
  }

  /** Envia mídia (imagem, áudio, documento, vídeo). */
  async sendMedia(payload: SendMediaPayload): Promise<{ key: { id: string } }> {
    return this.request(
      'POST',
      `/message/sendMedia/${this.instanceName}`,
      payload
    )
  }

  /**
   * Simula "digitando..." ou "gravando..." para o contato.
   * Use antes de enviar mensagem para experiência mais natural.
   */
  async sendPresence(payload: SendPresencePayload): Promise<void> {
    await this.request(
      'POST',
      `/chat/sendPresence/${this.instanceName}`,
      payload
    )
  }

  /**
   * Envia texto com simulação de digitação antes.
   * Delay automático proporcional ao tamanho da mensagem.
   */
  async sendTextWithTyping(number: string, text: string): Promise<{ key: { id: string } }> {
    // Simula digitação: ~40ms por caractere, mín 800ms, máx 4000ms
    const typingMs = Math.min(Math.max(text.length * 40, 800), 4000)

    await this.sendPresence({ number, presence: 'composing', delay: typingMs })

    return this.sendText({ number, text, delay: typingMs })
  }

  // ════════════════════════════════════════════════════════════
  // PERFIL / CONTATO
  // ════════════════════════════════════════════════════════════

  /** Verifica se o número existe no WhatsApp. */
  async checkNumber(number: string): Promise<{ exists: boolean; jid: string }> {
    const res = await this.request<Array<{ exists: boolean; jid: string }>>(
      'POST',
      `/chat/whatsappNumbers/${this.instanceName}`,
      { numbers: [number] }
    )
    return res[0] ?? { exists: false, jid: '' }
  }

  /** Busca informações do perfil de um contato. */
  async getContactInfo(number: string): Promise<{
    name?: string
    pushName?: string
    profilePictureUrl?: string
  }> {
    return this.request(
      'POST',
      `/chat/fetchProfile/${this.instanceName}`,
      { number }
    )
  }
}

// ── Helpers de formatação de número ──────────────────────────

/**
 * Normaliza número para formato Evolution API.
 * Remove caracteres não numéricos, garante DDI 55.
 * Ex: "(71) 9 9999-9999" → "5571999999999"
 */
export function normalizeNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '')
  if (digits.startsWith('55')) return digits
  if (digits.startsWith('0')) return `55${digits.slice(1)}`
  return `55${digits}`
}

/**
 * Extrai número limpo de um JID do WhatsApp.
 * Ex: "5571999999999@s.whatsapp.net" → "5571999999999"
 */
export function jidToNumber(jid: string): string {
  return jid.split('@')[0].split(':')[0]
}
