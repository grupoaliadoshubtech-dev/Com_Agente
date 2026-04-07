// ─────────────────────────────────────────────────────────────
// types/index.ts  —  Tipos de domínio do AAD
// ─────────────────────────────────────────────────────────────

// ── RBAC ─────────────────────────────────────────────────────
export type UserRole = 'master' | 'supervisor' | 'atendente'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: UserRole
  tenantId: string        // ID da planilha do tenant (Google Sheets)
  tenantName: string
  // Toggles controlados pelo supervisor
  canViewDashboard: boolean
  canViewCRM: boolean
  canViewTranscricoes: boolean
  canViewSatisfacao: boolean
}

// ── TENANT (Empresa) ──────────────────────────────────────────
export interface Tenant {
  id: string              // ID da planilha Google Sheets do tenant
  name: string
  email: string
  phone: string
  planId: string
  status: 'active' | 'inactive' | 'trial'
  createdAt: string       // ISO 8601
  evolutionInstance?: string
}

// ── PLANO ─────────────────────────────────────────────────────
export interface Plan {
  id: string
  name: string
  price: number           // em centavos (0 = sob consulta)
  period: 'monthly' | 'yearly' | 'custom'
  maxInstances: number
  maxAttendants: number
  features: string[]      // JSON serializado na planilha
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
  // Toggles do supervisor
  canViewDashboard: boolean
  canViewCRM: boolean
  canViewTranscricoes: boolean
  canViewSatisfacao: boolean
  createdAt: string
  isActive: boolean
}

// ── HANDOFF ───────────────────────────────────────────────────
export interface HandoffRecord {
  telefone: string        // número do cliente OU "ALL" (kill switch)
  status: 'pausado' | 'ativo'
  timestamp: string       // ISO 8601
  atendente: string       // ID do atendente logado
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

// ── CLIENTE (CRM) ─────────────────────────────────────────────
export interface ClientRecord {
  telefone: string
  nome: string
  status: string
  historico?: string
}

// ── ATENDIMENTO (Transcrição) ─────────────────────────────────
export interface AtendimentoRecord {
  id: string
  telefone: string
  nome: string
  inicio: string
  fim?: string
  duracao?: string
  atendente: string       // ID do humano OU "Bot"
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

// ── API RESPONSE WRAPPER ──────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
