// ─────────────────────────────────────────────────────────────
// types/index.ts — Tipos de domínio do ComAgente
// FASE 4: Adicionado campos de funil, tags e follow-up no CRM
// ─────────────────────────────────────────────────────────────

// ── RBAC ─────────────────────────────────────────────────────
export type UserRole = 'master' | 'supervisor' | 'atendente'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: UserRole
  tenantId: string
  tenantName: string
  canViewDashboard: boolean
  canViewCRM: boolean
  canViewTranscricoes: boolean
  canViewSatisfacao: boolean
  canViewAgendamentos: boolean
}

// ── TENANT (Empresa) ──────────────────────────────────────────
export interface Tenant {
  id: string
  name: string
  email: string
  phone: string
  planId: string
  status: 'active' | 'inactive' | 'trial'
  createdAt: string
  evolutionInstance?: string
  spreadsheetId?: string
  supabaseSchema?: string
}

// ── PLANO ─────────────────────────────────────────────────────
export interface Plan {
  id: string
  name: string
  price: number
  period: 'monthly' | 'yearly' | 'custom'
  maxInstances: number
  maxAttendants: number
  features: string[]
  isActive: boolean
}

// ── USUÁRIO DA PLANILHA ───────────────────────────────────────
export interface UserRecord {
  id: string
  tenantId: string
  email: string
  passwordHash: string
  name: string
  role: UserRole
  phone?: string
  canViewDashboard: boolean
  canViewCRM: boolean
  canViewTranscricoes: boolean
  canViewSatisfacao: boolean
  canViewAgendamentos: boolean
  createdAt: string
  isActive: boolean
  avatarUrl?: string
  mustChangePassword?: boolean
}

// ── HANDOFF ───────────────────────────────────────────────────
export interface HandoffRecord {
  telefone: string
  status: 'pausado' | 'ativo'
  timestamp: string
  atendente: string
}

// ── LEAD ─────────────────────────────────────────────────────
export interface LeadRecord {
  id: string
  name: string
  email: string
  phone: string
  company: string
  planId: string
  planName: string
  status: 'new' | 'contacted' | 'converted' | 'lost'
  createdAt: string
}

// ── CLIENTE (CRM) — FASE 4: Campos de funil e follow-up ─────
export type CRMStage =
  | 'novo'
  | 'em_atendimento'
  | 'proposta_enviada'
  | 'aguardando_resposta'
  | 'negociacao'
  | 'fechado'
  | 'perdido'

export interface ClientRecord {
  telefone:       string
  nome:           string
  status:         string
  historico?:     string
  // Fase 4: campos de funil
  etapa?:         CRMStage
  tags?:          string        // tags separadas por vírgula
  ultimoContato?: string        // ISO date
  proximoFollowUp?: string      // ISO date
  valorEstimado?: string        // valor em reais
  atendente?:     string        // atendente responsável
  notas?:         string        // notas internas
  origem?:        string        // como chegou (WhatsApp, site, indicação)
  createdAt?:     string        // data de criação
}

// ── ATENDIMENTO (Transcrição) ─────────────────────────────────
export interface AtendimentoRecord {
  id: string
  telefone: string
  nome: string
  inicio: string
  fim?: string
  duracao?: string
  atendente: string
  satisfacao?: number
}

// ── SATISFAÇÃO ────────────────────────────────────────────────
export interface SatisfacaoRecord {
  timestamp: string
  telefone: string
  nota: number
  atendimentoId: string
  atendente: string
}

// ── DIAGNÓSTICO ───────────────────────────────────────────────
export interface DiagnosticoRecord {
  id: string
  leadId: string
  token: string
  status: 'pending' | 'answered'
  responses: string // JSON stringificado { "1.1": "...", ... }
  createdAt: string
  respondedAt: string
}

// ── AGENDAMENTOS ─────────────────────────────────────────────
export interface AgendamentoRow {
  _rowIndex: number
  [key: string]: string | number
}

export interface AgendamentosData {
  headers: string[]
  dateCol: string | null
  statusCol: string | null
  records: AgendamentoRow[]
}

// ── API RESPONSE WRAPPER ──────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
