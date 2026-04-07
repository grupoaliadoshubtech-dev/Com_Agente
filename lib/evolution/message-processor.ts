// ─────────────────────────────────────────────────────────────
// lib/evolution/message-processor.ts
//
// NÚCLEO DO HANDOFF — processa cada mensagem recebida pelo webhook:
// 1. Filtra grupos, status, mensagens próprias
// 2. Checa blacklist
// 3. Checa se IA está pausada (lê Fila_Humana no Sheets)
// 4. Se pausado → notifica atendente via WA
// 5. Se ativo   → monta contexto e encaminha para o n8n/IA
// 6. Grava log no Sheets (aba Atendimentos)
// ─────────────────────────────────────────────────────────────

import { EvolutionClient, normalizeNumber } from './client'
import {
  extractMessageText,
  remoteJidToPhone,
  isGroupMessage,
  isStatusMessage,
  type WebhookMessage,
} from './webhook-types'
import { HandoffRepository }   from '@/lib/repositories/handoff.repository'
import { BlacklistRepository } from '@/lib/repositories/blacklist.repository'
import { readRange, appendRows, rowsToObjects } from '@/lib/sheets/client'

// ── Config ────────────────────────────────────────────────────

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL ?? ''

export interface ProcessorConfig {
  tenantSpreadsheetId: string
  instanceName:        string
  attendantNumber:     string  // número do atendente para notificações
}

// ── Processor ─────────────────────────────────────────────────

export class MessageProcessor {
  private evolution:  EvolutionClient
  private handoff:    HandoffRepository
  private blacklist:  BlacklistRepository
  private config:     ProcessorConfig

  constructor(config: ProcessorConfig) {
    this.config    = config
    this.evolution = EvolutionClient.fromEnv(config.instanceName)
    this.handoff   = new HandoffRepository(config.tenantSpreadsheetId)
    this.blacklist  = new BlacklistRepository(config.tenantSpreadsheetId)
  }

  async process(msg: WebhookMessage): Promise<void> {
    const jid  = msg.key.remoteJid
    const text = extractMessageText(msg.message)

    // ── 1. Filtros primários ──────────────────────────────────
    if (msg.key.fromMe)          return  // própria mensagem enviada pelo bot
    if (isGroupMessage(jid))     return  // grupos ignorados
    if (isStatusMessage(jid))    return  // stories ignorados
    if (!text && !this.hasMedia(msg)) return  // sem conteúdo processável

    const phone = remoteJidToPhone(jid)

    // ── 2. Blacklist ──────────────────────────────────────────
    const blocked = await this.blacklist.isBlocked(phone)
    if (blocked) {
      console.log(`[Processor] ${phone} está na blacklist — ignorado.`)
      return
    }

    // ── 3. Status de handoff ──────────────────────────────────
    const handoffStatus = await this.handoff.getStatus(phone)

    if (handoffStatus === 'pausado') {
      await this.handleHumanQueue(phone, text, msg)
      return
    }

    // ── 4. IA ativa → encaminha para n8n ─────────────────────
    await this.forwardToN8N(phone, text, msg)
  }

  // ── IA pausada: notifica atendente ───────────────────────────
  private async handleHumanQueue(
    phone:   string,
    text:    string,
    msg:     WebhookMessage
  ): Promise<void> {
    const pushName = msg.pushName ?? phone

    // Notifica o atendente via WhatsApp com contexto
    const notification =
      `🔔 *Nova mensagem na fila humana*\n\n` +
      `*Contato:* ${pushName} (${phone})\n` +
      `*Mensagem:* ${text || '[mídia]'}\n\n` +
      `Responda com:\n` +
      `/responder ${phone} [sua resposta]\n` +
      `/retornar ${phone}  (para devolver à IA)`

    await this.evolution.sendText({
      number: this.config.attendantNumber,
      text:   notification,
    })

    // Grava no log de atendimentos
    await this.logAtendimento(phone, pushName, 'humano', text)
  }

  // ── Encaminha para o n8n (IA Ana Maria) ──────────────────────
  private async forwardToN8N(
    phone: string,
    text:  string,
    msg:   WebhookMessage
  ): Promise<void> {
    if (!N8N_WEBHOOK_URL) {
      console.warn('[Processor] N8N_WEBHOOK_URL não configurado.')
      return
    }

    // Busca dados do cliente no Sheets para contexto
    const clientData = await this.getClientData(phone)

    const payload = {
      phone,
      pushName:    msg.pushName ?? phone,
      text,
      messageId:   msg.key.id,
      timestamp:   msg.messageTimestamp ?? Math.floor(Date.now() / 1000),
      hasMedia:    this.hasMedia(msg),
      mediaType:   this.getMediaType(msg),
      instance:    this.config.instanceName,
      tenantId:    this.config.tenantSpreadsheetId,
      // Contexto do cliente (injeta no prompt do Gemini)
      clientName:   clientData?.nome    ?? msg.pushName ?? '',
      clientStatus: clientData?.status  ?? 'novo',
      clientHistory:clientData?.historico ?? '',
    }

    await fetch(N8N_WEBHOOK_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
  }

  // ── Busca dados do cliente na aba Clientes ────────────────────
  private async getClientData(phone: string): Promise<{
    nome: string; status: string; historico: string
  } | null> {
    try {
      const rows = await readRange(
        this.config.tenantSpreadsheetId,
        'Clientes!A:D'
      )
      const records = rowsToObjects<Record<string, string>>(rows)
      const found   = records.find(r => r.telefone === phone || r.Telefone === phone)
      if (!found) return null
      return {
        nome:     found.nome     ?? found.Nome     ?? '',
        status:   found.status   ?? found.Status   ?? 'novo',
        historico:found.historico?? found.Historico?? '',
      }
    } catch {
      return null
    }
  }

  // ── Log de atendimento ────────────────────────────────────────
  private async logAtendimento(
    phone:   string,
    name:    string,
    tipo:    'ia' | 'humano',
    preview: string
  ): Promise<void> {
    try {
      await appendRows(
        this.config.tenantSpreadsheetId,
        'Atendimentos!A:H',
        [[
          `atd_${Date.now()}`,
          phone,
          name,
          new Date().toISOString(),
          '',                    // fim (preenchido no /finalizar)
          '',                    // duração
          tipo === 'ia' ? 'Bot' : this.config.attendantNumber,
          preview.slice(0, 100), // preview truncado
        ]]
      )
    } catch (err) {
      console.error('[Processor] Erro ao gravar atendimento:', err)
    }
  }

  // ── Helpers de tipo de mídia ──────────────────────────────────
  private hasMedia(msg: WebhookMessage): boolean {
    if (!msg.message) return false
    return !!(
      msg.message.imageMessage    ||
      msg.message.audioMessage    ||
      msg.message.videoMessage    ||
      msg.message.documentMessage ||
      msg.message.stickerMessage
    )
  }

  private getMediaType(msg: WebhookMessage): string | null {
    if (!msg.message) return null
    if (msg.message.imageMessage)    return 'image'
    if (msg.message.audioMessage)    return 'audio'
    if (msg.message.videoMessage)    return 'video'
    if (msg.message.documentMessage) return 'document'
    if (msg.message.stickerMessage)  return 'sticker'
    return null
  }
}
