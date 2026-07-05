// ─────────────────────────────────────────────────────────────
// lib/sheets/client.ts
// Cliente singleton autenticado para a Google Sheets API.
// Usa Service Account — zero OAuth flow no servidor.
// ─────────────────────────────────────────────────────────────

import { google, sheets_v4 } from 'googleapis'

let _sheets: sheets_v4.Sheets | null = null

/**
 * Retorna instância autenticada da Sheets API (singleton).
 * Lança erro se as variáveis de ambiente não estiverem configuradas.
 */
export function getSheetsClient(): sheets_v4.Sheets {
  if (_sheets) return _sheets

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key   = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!email || !key) {
    throw new Error(
      '[Sheets] GOOGLE_SERVICE_ACCOUNT_EMAIL ou GOOGLE_PRIVATE_KEY não configurados.'
    )
  }

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

  _sheets = google.sheets({ version: 'v4', auth })
  return _sheets
}

// ── Helpers de leitura / escrita ─────────────────────────────

/**
 * Lê um range de uma planilha e retorna matriz de valores.
 * Retorna [] se o range estiver vazio.
 */
export async function readRange(
  spreadsheetId: string,
  range: string
): Promise<string[][]> {
  const sheets = getSheetsClient()
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range })
  return (res.data.values as string[][] | null | undefined) ?? []
}

/**
 * Adiciona uma ou mais linhas ao final de um range (append).
 * Ideal para logs, fila_humana, leads, etc.
 */
export async function appendRows(
  spreadsheetId: string,
  range: string,
  rows: (string | number | boolean)[][]
): Promise<void> {
  const sheets = getSheetsClient()
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: rows },
  })
}

/**
 * Sobrescreve um range específico (update).
 * Use para atualizar status de uma linha já existente.
 */
export async function updateRange(
  spreadsheetId: string,
  range: string,
  rows: (string | number | boolean)[][]
): Promise<void> {
  const sheets = getSheetsClient()
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: rows },
  })
}

/**
 * Apaga linhas de uma aba pelo índice (0-based).
 * Os índices devem vir em ordem DECRESCENTE para evitar shift durante deleção.
 */
export async function deleteRows(
  spreadsheetId: string,
  sheetId: number,
  rowIndices: number[]
): Promise<void> {
  if (rowIndices.length === 0) return
  const sheets = getSheetsClient()
  const sorted = [...rowIndices].sort((a, b) => b - a) // decrescente
  const requests = sorted.map(i => ({
    deleteDimension: {
      range: { sheetId, dimension: 'ROWS', startIndex: i, endIndex: i + 1 },
    },
  }))
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })
}

/**
 * Retorna o sheetId numérico de uma aba pelo nome.
 * Necessário para deleteRows (que usa batchUpdate com índice numérico).
 */
export async function getSheetId(
  spreadsheetId: string,
  sheetName: string
): Promise<number> {
  const sheets = getSheetsClient()
  const res = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties' })
  const sheet = res.data.sheets?.find(s => s.properties?.title === sheetName)
  if (!sheet?.properties?.sheetId == null) throw new Error(`Aba "${sheetName}" não encontrada`)
  return sheet.properties!.sheetId!
}

/**
 * Limpa um range (útil para resetar fila).
 */
export async function clearRange(
  spreadsheetId: string,
  range: string
): Promise<void> {
  const sheets = getSheetsClient()
  await sheets.spreadsheets.values.clear({ spreadsheetId, range })
}

/**
 * Converte a primeira linha em headers e o restante em objetos.
 * Ex: [['id','nome'],['1','João']] => [{ id:'1', nome:'João' }]
 */
export function rowsToObjects<T extends Record<string, string>>(
  rows: string[][]
): T[] {
  if (rows.length < 2) return []
  const [headers, ...data] = rows
  return data.map(row =>
    Object.fromEntries(
      headers.map((h, i) => [h, row[i] ?? ''])
    ) as T
  )
}
