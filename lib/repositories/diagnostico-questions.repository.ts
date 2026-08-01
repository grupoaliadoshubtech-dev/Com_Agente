// ─────────────────────────────────────────────────────────────
// lib/repositories/diagnostico-questions.repository.ts
//
// Aba "DiagnosticoPerguntas" da planilha MASTER.
// Colunas: id | sectionIndex | sectionTitle | sectionSubtitle | questionIndex | question
// ─────────────────────────────────────────────────────────────

import { readRange, appendRows, updateRange, rowsToObjects } from '@/lib/sheets/client'
import { randomUUID } from 'crypto'

const MASTER_ID = process.env.GOOGLE_MASTER_SHEET_ID!
const SHEET     = 'DiagnosticoPerguntas'

export interface QuestionRecord {
  id: string
  sectionIndex: number
  sectionTitle: string
  sectionSubtitle: string
  questionIndex: number
  question: string
}

// Perguntas padrão (seed) — usadas se a aba estiver vazia
export const DEFAULT_SECTIONS = [
  { title:'Escopo de Serviços', subtitle:'Defina os limites de atuação da sua empresa', questions:['Quais são os principais produtos/serviços que sua empresa oferece hoje?','Existe algum tipo de produto/serviço que a empresa prefere não atender?','Qual o perfil de cliente ideal (porte, segmento, localização)?','Existem pacotes ou serviços específicos para cada perfil de cliente?'] },
  { title:'Diferenciação', subtitle:'O que torna sua empresa única', questions:['Qual o principal diferencial da sua empresa frente aos concorrentes?','Como funciona a entrega completa do seu serviço/produto (do início ao fim)?','O que sua empresa NÃO oferece ou faz?','Como a IA deve lidar com pedidos fora do escopo da empresa?'] },
  { title:'Primeiro Contato', subtitle:'Como a IA recepciona o cliente', questions:['Como é feito o primeiro atendimento hoje (presencial, online, telefone)?','Quais informações são coletadas no primeiro contato com o cliente?','Como é feita a qualificação do lead (interesse real vs. curiosidade)?','Existe algum atendimento que só pode ser realizado por um humano?'] },
  { title:'Processos: Do Contato ao Fechamento', subtitle:'Fluxo de vendas e proposta', questions:['Como é o processo atual de envio de propostas/orçamentos?','Quais informações são ESSENCIAIS para elaborar uma proposta?','Existe um valor ou pedido mínimo para aceitar um cliente?','Quais são as formas e condições de pagamento aceitas?'] },
  { title:'Identidade Visual e Posicionamento', subtitle:'A personalidade da sua marca', questions:['Como você descreveria a identidade visual e o posicionamento da empresa?','Existe algum estilo ou abordagem que a empresa prefere evitar?','Como o portfólio/catálogo é apresentado hoje aos clientes?','Quais as principais referências ou inspirações da marca?'] },
  { title:'Área de Atendimento e Capacidade', subtitle:'Alcance e limitações operacionais', questions:['Qual é a área geográfica de atendimento da empresa?','Como funcionam os custos para atendimentos fora da área habitual?','Qual a capacidade máxima de atendimentos simultâneos?','Como é feita a gestão de demanda em períodos de alta procura?'] },
  { title:'Regras de Atendimento da IA', subtitle:'Como a IA deve conduzir cada conversa', questions:['Qual a sequência ideal de perguntas para qualificar um cliente?','Quais informações a IA deve priorizar para ser mais eficiente?','Como a IA deve lidar com clientes que dão respostas incompletas?','A IA deve insistir, oferecer opções ou acionar um humano?'] },
  { title:'Transição: Quando o Humano Deve Assumir?', subtitle:'Sinais de alerta e handoff', questions:['Quais são os "sinais de alerta" para acionar um atendente humano?','Em quais situações o atendimento deve ser transferido imediatamente?','Existe um limite de mensagens antes de transferir para um humano?','Como a IA deve se despedir ao transferir o atendimento?'] },
  { title:'Autonomia da IA', subtitle:'O que a IA pode resolver sozinha', questions:['Quais informações a IA pode fornecer sem auxílio humano (FAQs, prazos, disponibilidade)?','A IA pode enviar catálogos ou portfólios no WhatsApp?','A IA pode falar sobre preços ou deve aguardar o humano?','Como esses materiais devem ser apresentados para encantar o cliente?'] },
  { title:'Pós-Venda e Fidelização', subtitle:'Relacionamento além da venda', questions:['Como é feito o acompanhamento após a venda ou entrega do serviço?','Existem programas de fidelidade ou benefícios para indicações?','Como a IA pode coletar feedback e depoimentos dos clientes?','Quais diferenciais a IA deve reforçar frente aos concorrentes?'] },
  { title:'Tom de Voz e Personalidade da IA', subtitle:'A identidade da sua IA', questions:['Qual o tom de voz ideal para a IA da sua empresa (formal, amigável, descontraído)?','A IA deve usar emojis? Com que frequência e estilo?','Existem palavras ou termos técnicos que a IA deve ou não usar?','A IA deve se apresentar com um nome próprio? Se sim, qual?'] },
  { title:'Visão de Futuro', subtitle:'Objetivos com a automação', questions:['Quais os principais objetivos com a automação do atendimento?','Existe alguma preocupação ética ou de privacidade com os dados?','Como você visualiza o sucesso desse projeto daqui a um ano?','Alguma informação importante sobre sua empresa que ainda não foi mencionada?'] },
]

function defaultRecords(): QuestionRecord[] {
  const records: QuestionRecord[] = []
  DEFAULT_SECTIONS.forEach((sec, si) => {
    sec.questions.forEach((q, qi) => {
      records.push({ id: randomUUID(), sectionIndex: si + 1, sectionTitle: sec.title, sectionSubtitle: sec.subtitle, questionIndex: qi + 1, question: q })
    })
  })
  return records
}

export class DiagnosticoQuestionsRepository {
  private spreadsheetId = MASTER_ID

  private parse(raw: Record<string, string>): QuestionRecord {
    return {
      id:             raw.id,
      sectionIndex:   Number(raw.sectionIndex),
      sectionTitle:   raw.sectionTitle,
      sectionSubtitle:raw.sectionSubtitle,
      questionIndex:  Number(raw.questionIndex),
      question:       raw.question,
    }
  }

  async findAll(): Promise<QuestionRecord[]> {
    const rows = await readRange(this.spreadsheetId, `${SHEET}!A:F`)
    const records = rowsToObjects<Record<string, string>>(rows).map(r => this.parse(r))
    if (records.length === 0) {
      await this.seed()
      return defaultRecords()
    }
    return records.sort((a, b) => a.sectionIndex - b.sectionIndex || a.questionIndex - b.questionIndex)
  }

  private async seed(): Promise<void> {
    const rows = defaultRecords().map(r => [r.id, r.sectionIndex, r.sectionTitle, r.sectionSubtitle, r.questionIndex, r.question])
    await appendRows(this.spreadsheetId, `${SHEET}!A:F`, rows)
  }

  async create(data: Omit<QuestionRecord, 'id'>): Promise<QuestionRecord> {
    const record: QuestionRecord = { id: randomUUID(), ...data }
    await appendRows(this.spreadsheetId, `${SHEET}!A:F`, [[
      record.id, record.sectionIndex, record.sectionTitle, record.sectionSubtitle, record.questionIndex, record.question,
    ]])
    return record
  }

  async updateById(id: string, data: Partial<Pick<QuestionRecord, 'sectionTitle' | 'sectionSubtitle' | 'question' | 'sectionIndex' | 'questionIndex'>>): Promise<boolean> {
    const rows = await readRange(this.spreadsheetId, `${SHEET}!A:F`)
    if (rows.length < 2) return false
    const headers  = rows[0]
    const idCol    = headers.indexOf('id')
    const rowIndex = rows.findIndex((r, i) => i > 0 && r[idCol] === id)
    if (rowIndex === -1) return false
    const sheetRow = rowIndex + 1
    const col      = (name: string) => String.fromCharCode(65 + headers.indexOf(name))
    const updates: Promise<void>[] = []
    if (data.sectionTitle    !== undefined) updates.push(updateRange(this.spreadsheetId, `${SHEET}!${col('sectionTitle')}${sheetRow}`,    [[data.sectionTitle]]))
    if (data.sectionSubtitle !== undefined) updates.push(updateRange(this.spreadsheetId, `${SHEET}!${col('sectionSubtitle')}${sheetRow}`, [[data.sectionSubtitle]]))
    if (data.question        !== undefined) updates.push(updateRange(this.spreadsheetId, `${SHEET}!${col('question')}${sheetRow}`,        [[data.question]]))
    if (data.sectionIndex    !== undefined) updates.push(updateRange(this.spreadsheetId, `${SHEET}!${col('sectionIndex')}${sheetRow}`,    [[data.sectionIndex]]))
    if (data.questionIndex   !== undefined) updates.push(updateRange(this.spreadsheetId, `${SHEET}!${col('questionIndex')}${sheetRow}`,   [[data.questionIndex]]))
    await Promise.all(updates)
    return true
  }

  async deleteById(id: string): Promise<boolean> {
    // Marca a pergunta como excluída zerando o campo question (não há delete de linha em Sheets)
    // Estratégia: sobrescreve todos os campos com string vazia marcando como deletado
    const rows = await readRange(this.spreadsheetId, `${SHEET}!A:F`)
    if (rows.length < 2) return false
    const headers  = rows[0]
    const idCol    = headers.indexOf('id')
    const rowIndex = rows.findIndex((r, i) => i > 0 && r[idCol] === id)
    if (rowIndex === -1) return false
    const sheetRow = rowIndex + 1
    await updateRange(this.spreadsheetId, `${SHEET}!A${sheetRow}:F${sheetRow}`, [['_deleted', 0, '', '', 0, '']])
    return true
  }
}
