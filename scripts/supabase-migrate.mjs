// scripts/supabase-migrate.mjs — desabilita cert check (apenas para migration local)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
// Executa a migration 001_initial_schema.sql no Supabase.
// Uso: node scripts/supabase-migrate.mjs

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import pg from 'pg'

const { Pool } = pg

const __dir = dirname(fileURLToPath(import.meta.url))
const sql   = readFileSync(join(__dir, '../supabase/migrations/001_initial_schema.sql'), 'utf8')

const url = process.env.SUPABASE_DATABASE_URL
if (!url) {
  console.error('Variável SUPABASE_DATABASE_URL não definida.')
  console.error('Exemplo: SUPABASE_DATABASE_URL=postgresql://postgres:senha@... node scripts/supabase-migrate.mjs')
  process.exit(1)
}

// pg v8 em Node 24 exige rejectUnauthorized via objeto ssl explícito
const pool = new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false, checkServerIdentity: () => undefined },
})

try {
  console.log('Conectando ao Supabase...')
  const client = await pool.connect()
  console.log('Executando migration 001...')
  await client.query(sql)
  client.release()
  console.log('✓ Migration executada com sucesso.')
} catch (err) {
  console.error('Erro na migration:', err.message)
  process.exit(1)
} finally {
  await pool.end()
}
