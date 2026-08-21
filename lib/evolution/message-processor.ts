// ─────────────────────────────────────────────────────────────
// lib/evolution/message-processor.ts
// FASE 8 — Bot com memória e contexto.
//
// Envia histórico de conversa completo ao n8n/Gemini.
// Detecta intenção e classifica leads no CRM automaticamente.
// Mantém Fase 6 (distribuição automática).
// ─────────────────────────────────────────────────────────────

import { EvolutionClient } from './client'
import {
  extractMessageText,
  remoteJidToPhone,
  isGroupMessage,
  isStatusMessage,
  type WebhookMessage,
} from './webhook-types'
import { HandoffRepository }          from '@/lib/repositories/handoff.repository'
import { BlacklistRepository }        from '@/lib/repositories/blacklist.repository'
import { DistributionRepository }     from '@/lib/repositories/distribution.repository'
import { ClientesRepository }         from '@/lib/repositories/clientes.repository'
import { AtendimentosRepository }     from '@/lib/repositories/analytics.repository'
import { ConversationContextService } from './conversation-context'

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL ?? ''

export interface ProcessorConfig {
  tenantSchema:    string   // schema PostgreSQL do tenant (ex: tenant_lucena)
  instanceName:    string
  attendantNumber: string
}

const INTENCAO_PARA_ETAPA: Record<string, string> = {
  'compra': 'em_atendimento', 'suporte': 'em_atendimento',
  'cancelamento': 'negociacao', 'informacao': 'novo',
  'agendamento': 'proposta_enviada', 'reclamacao': 'em_atendimento', 'elogio': 'fechado',
}

export class MessageProcessor {
  private evolution:     EvolutionClient
  private handoff:       HandoffRepository
  private blacklist:     BlacklistRepository
  private distribution:  DistributionRepository
  private clientes:      ClientesRepository
  private atendimentos:  AtendimentosRepository
  private context:       ConversationContextService
  private config:        ProcessorConfig

  constructor(config: ProcessorConfig) {
    this.config       = config
    this.evolution    = EvolutionClient.fromEnv(config.instanceName)
    this.handoff      = new HandoffRepository(config.tenantSchema)
    this.blacklist    = new BlacklistRepository(config.tenantSchema)
    this.distribution = new DistributionRepository(config.tenantSchema)
    this.clientes     = new ClientesRepository(config.tenantSchema)
    this.atendimentos = new AtendimentosRepository(config.tenantSchema)
    this.context      = new ConversationContextService(config.instanceName)
  }

  async process(msg: WebhookMessage): Promise<void> {
    const jid  = msg.key.remoteJid
    const text = extractMessageText(msg.message)
    if (msg.key.fromMe || isGroupMessage(jid) || isStatusMessage(jid)) return
    if (!text && !this.hasMedia(msg)) return
    const phone = remoteJidToPhone(jid)

    const blocked = await this.blacklist.isBlocked(phone)
    if (blocked) { console.log(`[Processor] ${phone} blacklist`); return }

    const handoffStatus = await this.handoff.getStatus(phone)
    if (handoffStatus === 'pausado') { await this.handleHumanQueue(phone, text, msg); return }

    await this.forwardToN8NWithContext(phone, text, msg)
  }

  private async forwardToN8NWithContext(phone: string, text: string, msg: WebhookMessage): Promise<void> {
    if (!N8N_WEBHOOK_URL) { console.warn('[Processor] N8N_WEBHOOK_URL não configurado.'); return }

    const clientData = await this.getClientData(phone)

    let conversationContext = ''
    let compactContext = ''
    let intencao: string | null = null

    try {
      const ctx = await this.context.getContext(phone, 20)
      conversationContext = ctx.resumo
      intencao = ctx.intencaoDetectada
      compactContext = await this.context.getCompactContext(phone)
    } catch (err) {
      console.error('[Processor] Erro contexto:', err)
      conversationContext = 'Erro ao buscar histórico. Trate como primeiro contato.'
    }

    const payload = {
      phone,
      pushName:      msg.pushName ?? phone,
      text,
      messageId:     msg.key.id,
      timestamp:     msg.messageTimestamp ?? Math.floor(Date.now() / 1000),
      hasMedia:      this.hasMedia(msg),
      mediaType:     this.getMediaType(msg),
      instance:      this.config.instanceName,
      tenantId:      this.config.tenantSchema,
      clientName:    clientData?.nome      ?? msg.pushName ?? '',
      clientStatus:  clientData?.status    ?? 'novo',
      clientHistory: clientData?.historico ?? '',
      clientEtapa:   clientData?.etapa     ?? 'novo',
      clientTags:    clientData?.tags      ?? '',
      conversationHistory: conversationContext,
      compactHistory:      compactContext,
      detectedIntent:      intencao,
      systemInstructions:  this.buildInstructions(clientData, intencao),
    }

    try {
      await fetch(N8N_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      if (intencao) await this.atualizarCRM(phone, msg.pushName ?? phone, intencao)
    } catch (err) { console.error('[Processor] Erro n8n:', err) }
  }

  private buildInstructions(clientData: { nome: string; status: string; etapa?: string; tags?: string } | null, intencao: string | null): string {
    const l: string[] = ['CONTEXTO:']
    if (clientData) {
      if (clientData.nome) l.push(`- Cliente: ${clientData.nome}`)
      if (clientData.etapa) l.push(`- Etapa: ${clientData.etapa}`)
      if (clientData.tags) l.push(`- Tags: ${clientData.tags}`)
    }
    if (intencao) {
      l.push(`- Intenção: ${intencao}`)
      const acoes: Record<string, string> = {
        'compra': 'Apresente opções e conduza para fechamento.',
        'suporte': 'Seja empático e resolva passo a passo.',
        'cancelamento': 'Entenda o motivo e tente reter.',
        'reclamacao': 'Peça desculpas e proponha resolução.',
        'agendamento': 'Ofereça horários e confirme.',
        'elogio': 'Agradeça e peça avaliação.',
      }
      if (acoes[intencao]) l.push(`- AÇÃO: ${acoes[intencao]}`)
    }
    l.push('', 'REGRAS:', '- NÃO repita perguntas já respondidas', '- Use o nome do cliente', '- Continue de onde parou', '- Tom profissional e amigável', '- FORMATAÇÃO WHATSAPP OBRIGATÓRIA EM TODAS AS MENSAGENS: nunca escreva parágrafos longos em bloco único; quebre o texto em linhas curtas e objetivas; use uma linha em branco entre tópicos ou blocos de informação; quando listar dados (nome, data, status, valor, itens, etc.) coloque cada um em sua própria linha com *rótulo* em negrito; listas de opções devem ter cada item em uma linha separada; nunca concatene informações distintas na mesma linha')
    return l.join('\n')
  }

  private async atualizarCRM(phone: string, nome: string, intencao: string): Promise<void> {
    try {
      await this.clientes.upsertCRM({
        telefone: phone,
        nome,
        etapa:    INTENCAO_PARA_ETAPA[intencao] ?? 'novo',
        intencao,
      })
    } catch (err) { console.error('[Processor] Erro CRM:', err) }
  }

  private async handleHumanQueue(phone: string, text: string, msg: WebhookMessage): Promise<void> {
    const pushName = msg.pushName ?? phone
    const next = await this.distribution.getNextAttendant()
    let notifyNumber: string, notifyName: string

    if (next) {
      await this.distribution.atribuir(next.atendenteId, phone, 'round-robin')
      notifyNumber = next.atendentePhone; notifyName = next.atendenteNome
    } else {
      notifyNumber = this.config.attendantNumber; notifyName = 'Supervisor'
    }

    let ctxSummary = ''
    try { ctxSummary = await this.context.getCompactContext(phone); if (ctxSummary) ctxSummary = `\n📋 *Contexto:*\n${ctxSummary}\n` } catch {}

    const notification =
      `🔔 *Novo atendimento*\n\n*Contato:* ${pushName} (${phone})\n*Mensagem:* ${text || '[mídia]'}` +
      ctxSummary +
      `\n\n/responder ${phone} [resposta]\n/retornar ${phone}\n/finalizar ${phone}`

    if (notifyNumber) {
      await this.evolution.sendText({ number: notifyNumber, text: notification }).catch(err => {
        console.error(`[Processor] Erro notificar ${notifyName}:`, err)
        if (notifyNumber !== this.config.attendantNumber)
          this.evolution.sendText({ number: this.config.attendantNumber, text: `⚠ Fallback:\n${notification}` }).catch(console.error)
      })
    }

    await this.logAtendimento(phone, pushName, 'humano', text, notifyName)
  }

  private async getClientData(phone: string): Promise<{ nome: string; status: string; historico: string; etapa?: string; tags?: string } | null> {
    try {
      const row = await this.clientes.findByPhone(phone)
      if (!row) return null
      return { nome: row.nome, status: row.status, historico: row.historico, etapa: row.etapa, tags: row.tags }
    } catch { return null }
  }

  private async logAtendimento(phone: string, name: string, tipo: 'ia' | 'humano', preview: string, atendente?: string): Promise<void> {
    try {
      await this.atendimentos.create({
        id:        `atd_${Date.now()}`,
        telefone:  phone,
        nome:      name,
        atendente: tipo === 'ia' ? 'Bot' : (atendente ?? this.config.attendantNumber),
        preview:   preview.slice(0, 100),
      })
    } catch (err) { console.error('[Processor] Erro log:', err) }
  }

  private hasMedia(msg: WebhookMessage): boolean {
    if (!msg.message) return false
    return !!(msg.message.imageMessage || msg.message.audioMessage || msg.message.videoMessage || msg.message.documentMessage || msg.message.stickerMessage)
  }

  private getMediaType(msg: WebhookMessage): string | null {
    if (!msg.message) return null
    if (msg.message.imageMessage) return 'image'; if (msg.message.audioMessage) return 'audio'
    if (msg.message.videoMessage) return 'video'; if (msg.message.documentMessage) return 'document'
    if (msg.message.stickerMessage) return 'sticker'; return null
  }
}
