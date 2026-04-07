// ─────────────────────────────────────────────────────────────
// lib/evolution/webhook-types.ts
// Tipos TypeScript para todos os eventos do webhook Evolution API v2.
// ─────────────────────────────────────────────────────────────

export type EvolutionEventType =
  | 'MESSAGES_UPSERT'
  | 'MESSAGES_UPDATE'
  | 'MESSAGES_DELETE'
  | 'SEND_MESSAGE'
  | 'CONTACTS_UPSERT'
  | 'CONTACTS_UPDATE'
  | 'PRESENCE_UPDATE'
  | 'CHATS_UPSERT'
  | 'CHATS_UPDATE'
  | 'CHATS_DELETE'
  | 'GROUPS_UPSERT'
  | 'GROUP_PARTICIPANTS_UPDATE'
  | 'CONNECTION_UPDATE'
  | 'LABELS_EDIT'
  | 'LABELS_ASSOCIATION'
  | 'CALL'
  | 'NEW_JWT_TOKEN'

// ── Estrutura base do webhook ─────────────────────────────────

export interface EvolutionWebhookPayload {
  event:        EvolutionEventType
  instance:     string                // nome da instância
  data:         unknown               // tipado abaixo por evento
  destination?: string
  date_time?:   string
  sender?:      string
  server_url?:  string
  apikey?:      string
}

// ── Mensagem (MESSAGES_UPSERT) ────────────────────────────────

export interface MessageKey {
  remoteJid: string          // ex: "5571999999999@s.whatsapp.net"
  fromMe:    boolean
  id:        string          // ID único da mensagem
  participant?: string       // em grupos
}

export interface MessageContent {
  conversation?:     string  // texto simples
  extendedTextMessage?: {
    text: string
    contextInfo?: { quotedMessage?: unknown }
  }
  imageMessage?: {
    caption?: string
    mimetype: string
    url?:     string
  }
  audioMessage?: {
    mimetype:  string
    url?:      string
    seconds?:  number
    ptt?:      boolean       // push-to-talk (áudio gravado)
  }
  documentMessage?: {
    title?:    string
    mimetype:  string
    url?:      string
  }
  videoMessage?: {
    caption?: string
    mimetype: string
    url?:     string
  }
  stickerMessage?: { url?: string }
  locationMessage?: {
    degreesLatitude:  number
    degreesLongitude: number
    name?:            string
    address?:         string
  }
  contactMessage?: {
    displayName: string
    vcard:       string
  }
  reactionMessage?: {
    key:  MessageKey
    text: string
  }
  pollCreationMessage?: {
    name:    string
    options: Array<{ optionName: string }>
  }
  pollUpdateMessage?: {
    pollCreationMessageKey: MessageKey
    vote: { selectedOptions: string[] }
  }
  templateButtonReplyMessage?: {
    selectedId:          string
    selectedDisplayText: string
  }
  listResponseMessage?: {
    singleSelectReply?: { selectedRowId: string }
  }
}

export interface WebhookMessage {
  key:              MessageKey
  pushName?:        string      // nome do contato
  status?:          string
  message?:         MessageContent
  messageTimestamp?: number
  messageType?:     string
  instanceId?:      string
}

export interface MessagesUpsertData {
  messages: WebhookMessage[]
  type:     'notify' | 'append' | 'replace'
}

// ── Connection update ─────────────────────────────────────────

export interface ConnectionUpdateData {
  instance: string
  state:    'open' | 'close' | 'connecting' | 'refused'
  statusReason?: number
}

// ── Presence update ───────────────────────────────────────────

export interface PresenceUpdateData {
  id:       string
  presences: Record<string, {
    lastKnownPresence: 'available' | 'unavailable' | 'composing' | 'recording' | 'paused'
    lastSeen?:         number
  }>
}

// ── Helper: extrai texto de qualquer tipo de mensagem ─────────

export function extractMessageText(message?: MessageContent): string {
  if (!message) return ''
  return (
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    message.videoMessage?.caption ??
    message.documentMessage?.title ??
    message.templateButtonReplyMessage?.selectedDisplayText ??
    message.listResponseMessage?.singleSelectReply?.selectedRowId ??
    ''
  )
}

/** Retorna número limpo a partir do remoteJid. */
export function remoteJidToPhone(jid: string): string {
  return jid.split('@')[0].split(':')[0]
}

/** Verifica se a mensagem é de um grupo (ignorar). */
export function isGroupMessage(jid: string): boolean {
  return jid.endsWith('@g.us')
}

/** Verifica se é mensagem de status (Stories). */
export function isStatusMessage(jid: string): boolean {
  return jid === 'status@broadcast'
}
