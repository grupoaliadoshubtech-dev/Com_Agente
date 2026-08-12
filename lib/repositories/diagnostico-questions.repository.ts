// lib/repositories/diagnostico-questions.repository.ts
// Migrado de Google Sheets → Supabase (schema: app)

import { query, execute } from '@/lib/supabase/client'
import { randomUUID } from 'crypto'

export interface QuestionRecord {
  id: string
  sectionIndex: number
  sectionTitle: string
  sectionSubtitle: string
  questionIndex: number
  question: string
}

function parse(row: Record<string, unknown>): QuestionRecord {
  return {
    id:              String(row.id),
    sectionIndex:    Number(row.section_index),
    sectionTitle:    String(row.section_title   ?? ''),
    sectionSubtitle: String(row.section_subtitle ?? ''),
    questionIndex:   Number(row.question_index),
    question:        String(row.question         ?? ''),
  }
}

export class DiagnosticoQuestionsRepository {
  async findAll(): Promise<QuestionRecord[]> {
    const rows = await query(
      'SELECT * FROM app.diagnostico_perguntas ORDER BY section_index, question_index'
    )
    return rows.map(parse)
  }

  async create(data: Omit<QuestionRecord, 'id'>): Promise<QuestionRecord> {
    const id = randomUUID()
    await execute(
      `INSERT INTO app.diagnostico_perguntas
         (id, section_index, section_title, section_subtitle, question_index, question)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, data.sectionIndex, data.sectionTitle, data.sectionSubtitle, data.questionIndex, data.question]
    )
    return { id, ...data }
  }

  async updateById(
    id: string,
    data: Partial<Pick<QuestionRecord, 'sectionTitle' | 'sectionSubtitle' | 'question' | 'sectionIndex' | 'questionIndex'>>
  ): Promise<boolean> {
    const sets: string[]  = []
    const vals: unknown[] = []
    let   idx             = 1

    if (data.sectionTitle    !== undefined) { sets.push(`section_title = $${idx++}`);    vals.push(data.sectionTitle) }
    if (data.sectionSubtitle !== undefined) { sets.push(`section_subtitle = $${idx++}`); vals.push(data.sectionSubtitle) }
    if (data.question        !== undefined) { sets.push(`question = $${idx++}`);         vals.push(data.question) }
    if (data.sectionIndex    !== undefined) { sets.push(`section_index = $${idx++}`);    vals.push(data.sectionIndex) }
    if (data.questionIndex   !== undefined) { sets.push(`question_index = $${idx++}`);   vals.push(data.questionIndex) }

    if (sets.length === 0) return false
    vals.push(id)
    const rows = await query<{ id: string }>(
      `UPDATE app.diagnostico_perguntas SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id`,
      vals
    )
    return rows.length > 0
  }

  async deleteById(id: string): Promise<boolean> {
    const rows = await query<{ id: string }>(
      'DELETE FROM app.diagnostico_perguntas WHERE id = $1 RETURNING id',
      [id]
    )
    return rows.length > 0
  }
}
