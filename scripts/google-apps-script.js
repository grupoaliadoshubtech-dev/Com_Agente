// ═══════════════════════════════════════════════════════════════
// AAD — Agência de Atendimento Digital
// Script de criação da Planilha MASTER no Google Sheets
//
// COMO USAR:
// 1. Abra o Google Sheets em uma planilha vazia
// 2. Vá em Extensões → Apps Script
// 3. Cole este código e clique em "Executar" (função: criarPlanilhaMaster)
// 4. Autorize as permissões solicitadas
// 5. Aguarde a execução — a planilha será configurada automaticamente
//
// Após rodar, compartilhe a planilha com o e-mail do Service Account
// com permissão de Editor.
// ═══════════════════════════════════════════════════════════════

// ── Configurações ──────────────────────────────────────────────
const CONFIG = {
  // E-mail do Master Admin inicial (será criado automaticamente)
  MASTER_EMAIL: "admin@suaempresa.com.br",
  MASTER_NAME:  "Master Admin",

  // Senha inicial — TROQUE imediatamente após o primeiro login
  // Hash bcrypt gerado em: https://bcrypt-generator.com (rounds: 12)
  // Senha padrão abaixo = "Admin@1234"
  MASTER_PASSWORD_HASH: "$2a$12$Kix4hvDynCI.9lBNXdlrK.xYzPZMB2fKLqkAHiA2hM4t5GKlMkdpq",

  // Cor primária do tema (neon verde AAD)
  COR_HEADER:      "#A3E635",
  COR_HEADER_FONT: "#0A0A0A",
  COR_SUBHEADER:   "#1E1E1E",
  COR_ZEBRA:       "#F8FFF0",
  COR_BORDA:       "#D4EDAB",
}

// ── Ponto de entrada ───────────────────────────────────────────
function criarPlanilhaMaster() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  ss.setName("AAD — Master")

  Logger.log("▶ Iniciando criação da planilha Master...")

  // Remove aba padrão "Planilha1" se existir ao final
  const abas = [
    criarAbaUsuarios(ss),
    criarAbaEmpresas(ss),
    criarAbaPlanos(ss),
    criarAbaLeads(ss),
    criarAbaResetTokens(ss),
    criarAbaBlacklist(ss),
    criarAbaLogErros(ss),
  ]

  // Remove aba "Planilha1" se ainda existir
  const abaDefault = ss.getSheetByName("Planilha1") || ss.getSheetByName("Sheet1")
  if (abaDefault) ss.deleteSheet(abaDefault)

  // Reordena abas
  abas.forEach((aba, i) => ss.setActiveSheet(aba).moveActiveTab(i + 1))

  // Protege abas críticas
  protegerAbas(ss)

  Logger.log("✅ Planilha Master criada com sucesso!")
  Logger.log("📋 ID da planilha: " + ss.getId())
  Logger.log("🔑 Compartilhe com o Service Account como Editor.")

  SpreadsheetApp.getUi().alert(
    "✅ Planilha Master criada!\n\n" +
    "ID: " + ss.getId() + "\n\n" +
    "Próximos passos:\n" +
    "1. Compartilhe esta planilha com o Service Account como Editor\n" +
    "2. Copie o ID acima para o GOOGLE_MASTER_SHEET_ID no .env.local\n" +
    "3. Troque a senha do Master Admin no primeiro login\n\n" +
    "Login inicial:\n" +
    "E-mail: " + CONFIG.MASTER_EMAIL + "\n" +
    "Senha: Admin@1234"
  )
}

// ═══════════════════════════════════════════════════════════════
// ABA: Usuarios
// id | tenantId | email | passwordHash | name | role | phone |
// canViewDashboard | canViewCRM | canViewTranscricoes |
// canViewSatisfacao | createdAt | isActive
// ═══════════════════════════════════════════════════════════════
function criarAbaUsuarios(ss) {
  const aba = obterOuCriarAba(ss, "Usuarios")
  aba.clearContents().clearFormats()

  const headers = [
    "id", "tenantId", "email", "passwordHash", "name",
    "role", "phone",
    "canViewDashboard", "canViewCRM", "canViewTranscricoes", "canViewSatisfacao",
    "createdAt", "isActive"
  ]

  // Linha de cabeçalho
  estilizarHeader(aba, headers)

  // Linha do Master Admin inicial
  const masterId = gerarUUID()
  const masterId_spreadsheet = ss.getId()
  const agora = new Date().toISOString()

  aba.getRange(2, 1, 1, headers.length).setValues([[
    masterId,
    masterId_spreadsheet,  // tenantId = própria planilha master
    CONFIG.MASTER_EMAIL,
    CONFIG.MASTER_PASSWORD_HASH,
    CONFIG.MASTER_NAME,
    "master",
    "",
    true, true, true, true,
    agora,
    true
  ]])

  // Larguras
  aba.setColumnWidth(1, 250)   // id (UUID)
  aba.setColumnWidth(2, 250)   // tenantId
  aba.setColumnWidth(3, 200)   // email
  aba.setColumnWidth(4, 300)   // passwordHash
  aba.setColumnWidth(5, 150)   // name
  aba.setColumnWidth(6, 100)   // role
  aba.setColumnWidth(7, 150)   // phone
  aba.setColumnWidths(8, 4, 80) // toggles
  aba.setColumnWidth(12, 200)  // createdAt
  aba.setColumnWidth(13, 80)   // isActive

  // Validação de role
  const regraRole = SpreadsheetApp.newDataValidation()
    .requireValueInList(["master", "supervisor", "atendente"])
    .setAllowInvalid(false)
    .build()
  aba.getRange("F2:F1000").setDataValidation(regraRole)

  // Validação booleana nos toggles
  const regraBooleano = SpreadsheetApp.newDataValidation()
    .requireCheckbox()
    .build()
  aba.getRange("H2:K1000").setDataValidation(regraBooleano)
  aba.getRange("M2:M1000").setDataValidation(regraBooleano)

  // Freeze
  aba.setFrozenRows(1)
  aba.setFrozenColumns(3)

  Logger.log("  ✓ Aba Usuarios criada com Master Admin")
  return aba
}

// ═══════════════════════════════════════════════════════════════
// ABA: Empresas (Tenants)
// id | name | email | phone | planId | status | createdAt | evolutionInstance
// ═══════════════════════════════════════════════════════════════
function criarAbaEmpresas(ss) {
  const aba = obterOuCriarAba(ss, "Empresas")
  aba.clearContents().clearFormats()

  const headers = [
    "id", "name", "email", "phone", "planId",
    "status", "createdAt", "evolutionInstance"
  ]

  estilizarHeader(aba, headers)

  // Linha de exemplo (comentada com cor cinza)
  aba.getRange(2, 1, 1, headers.length).setValues([[
    "# Exemplo — apague esta linha",
    "TrackerMap",
    "contato@trackermap.com.br",
    "5571999999999",
    "plan_id_aqui",
    "trial",
    new Date().toISOString(),
    "agenciadia"
  ]])
  aba.getRange(2, 1, 1, headers.length)
    .setFontColor("#888888")
    .setFontStyle("italic")

  // Validação de status
  const regraStatus = SpreadsheetApp.newDataValidation()
    .requireValueInList(["active", "trial", "inactive"])
    .setAllowInvalid(false)
    .build()
  aba.getRange("F2:F1000").setDataValidation(regraStatus)

  aba.setColumnWidth(1, 250)
  aba.setColumnWidth(2, 180)
  aba.setColumnWidth(3, 200)
  aba.setColumnWidth(4, 150)
  aba.setColumnWidth(5, 250)
  aba.setColumnWidth(6, 100)
  aba.setColumnWidth(7, 200)
  aba.setColumnWidth(8, 180)
  aba.setFrozenRows(1)

  Logger.log("  ✓ Aba Empresas criada")
  return aba
}

// ═══════════════════════════════════════════════════════════════
// ABA: Planos
// id | name | price | period | maxInstances | maxAttendants | features | isActive
// ═══════════════════════════════════════════════════════════════
function criarAbaPlanos(ss) {
  const aba = obterOuCriarAba(ss, "Planos")
  aba.clearContents().clearFormats()

  const headers = [
    "id", "name", "price", "period",
    "maxInstances", "maxAttendants", "features", "isActive"
  ]

  estilizarHeader(aba, headers)

  // 4 planos padrão do projeto TrackerMap
  const planos = [
    [
      gerarUUID(), "Starter", 19700, "monthly", 1, 2,
      JSON.stringify(["1 instância WhatsApp", "2 atendentes", "Dashboard básico", "Suporte via e-mail"]),
      true
    ],
    [
      gerarUUID(), "Professional", 49700, "monthly", 3, 10,
      JSON.stringify(["3 instâncias WhatsApp", "10 atendentes", "CRM completo", "Relatórios avançados", "Suporte prioritário"]),
      true
    ],
    [
      gerarUUID(), "Business", 99700, "monthly", 10, 999,
      JSON.stringify(["10 instâncias WhatsApp", "Atendentes ilimitados", "API access", "White-label", "SLA garantido"]),
      true
    ],
    [
      gerarUUID(), "Enterprise", 0, "custom", 999, 999,
      JSON.stringify(["Instâncias ilimitadas", "Infraestrutura dedicada", "Integração customizada", "CSM exclusivo"]),
      true
    ],
  ]

  aba.getRange(2, 1, planos.length, headers.length).setValues(planos)

  // Nota: price está em centavos (19700 = R$ 197,00)
  const nota = aba.getRange("C1")
  nota.setNote("Valor em centavos. Ex: 19700 = R$ 197,00. Use 0 para 'Sob consulta'.")

  // Validação
  const regraPeriodo = SpreadsheetApp.newDataValidation()
    .requireValueInList(["monthly", "yearly", "custom"])
    .setAllowInvalid(false).build()
  aba.getRange("D2:D1000").setDataValidation(regraPeriodo)

  const regraBooleano = SpreadsheetApp.newDataValidation()
    .requireCheckbox().build()
  aba.getRange("H2:H1000").setDataValidation(regraBooleano)

  aba.setColumnWidth(1, 250)
  aba.setColumnWidth(2, 150)
  aba.setColumnWidth(3, 100)
  aba.setColumnWidth(4, 100)
  aba.setColumnWidth(5, 120)
  aba.setColumnWidth(6, 130)
  aba.setColumnWidth(7, 400)
  aba.setColumnWidth(8, 80)
  aba.setFrozenRows(1)

  Logger.log("  ✓ Aba Planos criada com 4 planos padrão")
  return aba
}

// ═══════════════════════════════════════════════════════════════
// ABA: Leads
// id | name | email | phone | company | planId | planName | status | createdAt
// ═══════════════════════════════════════════════════════════════
function criarAbaLeads(ss) {
  const aba = obterOuCriarAba(ss, "Leads")
  aba.clearContents().clearFormats()

  const headers = [
    "id", "name", "email", "phone", "company",
    "planId", "planName", "status", "createdAt"
  ]

  estilizarHeader(aba, headers)

  // Validação de status
  const regraStatus = SpreadsheetApp.newDataValidation()
    .requireValueInList(["new", "contacted", "converted", "lost"])
    .setAllowInvalid(false).build()
  aba.getRange("H2:H1000").setDataValidation(regraStatus)

  aba.setColumnWidth(1, 250)
  aba.setColumnWidth(2, 180)
  aba.setColumnWidth(3, 200)
  aba.setColumnWidth(4, 150)
  aba.setColumnWidth(5, 180)
  aba.setColumnWidth(6, 250)
  aba.setColumnWidth(7, 150)
  aba.setColumnWidth(8, 100)
  aba.setColumnWidth(9, 200)
  aba.setFrozenRows(1)

  Logger.log("  ✓ Aba Leads criada")
  return aba
}

// ═══════════════════════════════════════════════════════════════
// ABA: ResetTokens
// token | userId | email | expiresAt | usedAt
// ═══════════════════════════════════════════════════════════════
function criarAbaResetTokens(ss) {
  const aba = obterOuCriarAba(ss, "ResetTokens")
  aba.clearContents().clearFormats()

  const headers = ["token", "userId", "email", "expiresAt", "usedAt"]
  estilizarHeader(aba, headers)

  // Nota explicativa
  aba.getRange("A1").setNote(
    "Tokens de recuperação de senha.\n" +
    "TTL: 1 hora (campo expiresAt).\n" +
    "Campo usedAt preenchido após uso.\n" +
    "Limpe linhas antigas periodicamente."
  )

  aba.setColumnWidth(1, 400)  // token (64 chars hex)
  aba.setColumnWidth(2, 250)  // userId
  aba.setColumnWidth(3, 200)  // email
  aba.setColumnWidth(4, 200)  // expiresAt
  aba.setColumnWidth(5, 200)  // usedAt
  aba.setFrozenRows(1)

  Logger.log("  ✓ Aba ResetTokens criada")
  return aba
}

// ═══════════════════════════════════════════════════════════════
// ABA: Blacklist (global — cross-tenant)
// telefone | motivo | atendente | timestamp | scope
// ═══════════════════════════════════════════════════════════════
function criarAbaBlacklist(ss) {
  const aba = obterOuCriarAba(ss, "Blacklist")
  aba.clearContents().clearFormats()

  const headers = ["telefone", "motivo", "atendente", "timestamp", "scope"]
  estilizarHeader(aba, headers)

  aba.getRange("A1").setNote(
    "Blacklist GLOBAL — números aqui são bloqueados em TODOS os tenants.\n" +
    "Scope: 'global' = bloqueio master. 'local' = vem de tenant específico.\n" +
    "Números locais ficam na aba Blacklist de cada planilha de tenant."
  )

  const regraScope = SpreadsheetApp.newDataValidation()
    .requireValueInList(["global", "local"])
    .setAllowInvalid(false).build()
  aba.getRange("E2:E1000").setDataValidation(regraScope)

  aba.setColumnWidth(1, 160)
  aba.setColumnWidth(2, 300)
  aba.setColumnWidth(3, 250)
  aba.setColumnWidth(4, 200)
  aba.setColumnWidth(5, 100)
  aba.setFrozenRows(1)

  Logger.log("  ✓ Aba Blacklist criada")
  return aba
}

// ═══════════════════════════════════════════════════════════════
// ABA: Log_Erros (da própria infra master)
// timestamp | no | erro | telefone
// ═══════════════════════════════════════════════════════════════
function criarAbaLogErros(ss) {
  const aba = obterOuCriarAba(ss, "Log_Erros")
  aba.clearContents().clearFormats()

  const headers = ["timestamp", "no", "erro", "telefone"]
  estilizarHeader(aba, headers)

  aba.setColumnWidth(1, 200)
  aba.setColumnWidth(2, 200)
  aba.setColumnWidth(3, 500)
  aba.setColumnWidth(4, 160)
  aba.setFrozenRows(1)

  Logger.log("  ✓ Aba Log_Erros criada")
  return aba
}

// ═══════════════════════════════════════════════════════════════
// FUNÇÃO BÔNUS: Criar planilha de TENANT
// Roda separadamente numa planilha vazia para cada novo tenant.
// ═══════════════════════════════════════════════════════════════
function criarPlanilhaTenant() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()

  const nomeTenant = SpreadsheetApp.getUi().prompt(
    "Nome do tenant", "Ex: TrackerMap", SpreadsheetApp.getUi().ButtonSet.OK_CANCEL
  )
  if (nomeTenant.getSelectedButton() !== SpreadsheetApp.getUi().Button.OK) return

  ss.setName("AAD — " + nomeTenant.getResponseText())
  Logger.log("▶ Criando planilha de tenant: " + nomeTenant.getResponseText())

  const abas = [
    criarAbaUsuariosTenant(ss),
    criarAbaFilaHumana(ss),
    criarAbaClientes(ss),
    criarAbaAtendimentos(ss),
    criarAbaSatisfacao(ss),
    criarAbaBlacklistTenant(ss),
    criarAbaConhecimento(ss),
    criarAbaLogErrosTenant(ss),
    criarAbaPrimeirosContatos(ss),
  ]

  const abaDefault = ss.getSheetByName("Planilha1") || ss.getSheetByName("Sheet1")
  if (abaDefault) ss.deleteSheet(abaDefault)

  abas.forEach((aba, i) => ss.setActiveSheet(aba).moveActiveTab(i + 1))
  protegerAbas(ss)

  Logger.log("✅ Planilha de tenant criada!")
  SpreadsheetApp.getUi().alert(
    "✅ Planilha do tenant criada!\n\n" +
    "ID: " + ss.getId() + "\n\n" +
    "Próximos passos:\n" +
    "1. Compartilhe com o Service Account como Editor\n" +
    "2. Use este ID como spreadsheetId ao provisionar o tenant no admin"
  )
}

// ── Abas do tenant ─────────────────────────────────────────────

function criarAbaUsuariosTenant(ss) {
  const aba = obterOuCriarAba(ss, "Usuarios")
  aba.clearContents().clearFormats()
  const headers = [
    "id", "tenantId", "email", "passwordHash", "name",
    "role", "phone",
    "canViewDashboard", "canViewCRM", "canViewTranscricoes", "canViewSatisfacao",
    "createdAt", "isActive"
  ]
  estilizarHeader(aba, headers)

  const regraRole = SpreadsheetApp.newDataValidation()
    .requireValueInList(["supervisor", "atendente"])
    .setAllowInvalid(false).build()
  aba.getRange("F2:F1000").setDataValidation(regraRole)

  const regraCheck = SpreadsheetApp.newDataValidation().requireCheckbox().build()
  aba.getRange("H2:K1000").setDataValidation(regraCheck)
  aba.getRange("M2:M1000").setDataValidation(regraCheck)

  aba.setColumnWidth(1, 250); aba.setColumnWidth(2, 250)
  aba.setColumnWidth(3, 200); aba.setColumnWidth(4, 300)
  aba.setColumnWidth(5, 150); aba.setColumnWidth(6, 100)
  aba.setFrozenRows(1); aba.setFrozenColumns(3)
  return aba
}

function criarAbaFilaHumana(ss) {
  const aba = obterOuCriarAba(ss, "Fila_Humana")
  aba.clearContents().clearFormats()

  // REGRA CENTRAL: exatamente 4 colunas conforme a spec
  const headers = ["Telefone", "Status", "Timestamp", "Atendente"]
  estilizarHeader(aba, headers)

  aba.getRange("A1").setNote(
    "REGRA DO HANDOFF:\n" +
    "A: Telefone do cliente OU 'ALL' (Kill Switch global)\n" +
    "B: 'pausado' ou 'ativo'\n" +
    "C: ISO 8601 timestamp\n" +
    "D: ID do atendente que executou a ação\n\n" +
    "O n8n lê esta aba a cada ciclo para saber se a IA está pausada."
  )

  const regraStatus = SpreadsheetApp.newDataValidation()
    .requireValueInList(["pausado", "ativo"])
    .setAllowInvalid(false).build()
  aba.getRange("B2:B10000").setDataValidation(regraStatus)

  aba.setColumnWidth(1, 160)   // Telefone
  aba.setColumnWidth(2, 100)   // Status
  aba.setColumnWidth(3, 220)   // Timestamp ISO
  aba.setColumnWidth(4, 250)   // Atendente

  // Formatação condicional: pausado = vermelho, ativo = verde
  const regras = aba.getConditionalFormatRules()

  const regPausado = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("pausado")
    .setBackground("#FEE2E2")
    .setFontColor("#991B1B")
    .setRanges([aba.getRange("B2:B10000")])
    .build()

  const regAtivo = SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo("ativo")
    .setBackground("#DCFCE7")
    .setFontColor("#166534")
    .setRanges([aba.getRange("B2:B10000")])
    .build()

  aba.setConditionalFormatRules([regPausado, regAtivo])
  aba.setFrozenRows(1)
  return aba
}

function criarAbaClientes(ss) {
  const aba = obterOuCriarAba(ss, "Clientes")
  aba.clearContents().clearFormats()
  estilizarHeader(aba, ["telefone", "nome", "status", "historico"])
  aba.setColumnWidth(1, 160); aba.setColumnWidth(2, 180)
  aba.setColumnWidth(3, 120); aba.setColumnWidth(4, 500)
  aba.setFrozenRows(1)
  return aba
}

function criarAbaAtendimentos(ss) {
  const aba = obterOuCriarAba(ss, "Atendimentos")
  aba.clearContents().clearFormats()
  const headers = ["id", "telefone", "nome", "inicio", "fim", "duracao", "atendente", "preview"]
  estilizarHeader(aba, headers)

  aba.getRange("D1").setNote("ISO 8601 — ex: 2026-03-29T14:30:00.000Z")
  aba.getRange("G1").setNote("ID do atendente humano OU 'Bot' se encerrado pela IA")

  aba.setColumnWidth(1, 200); aba.setColumnWidth(2, 160)
  aba.setColumnWidth(3, 180); aba.setColumnWidth(4, 220)
  aba.setColumnWidth(5, 220); aba.setColumnWidth(6, 100)
  aba.setColumnWidth(7, 250); aba.setColumnWidth(8, 400)
  aba.setFrozenRows(1)
  return aba
}

function criarAbaSatisfacao(ss) {
  const aba = obterOuCriarAba(ss, "Satisfacao")
  aba.clearContents().clearFormats()
  const headers = ["timestamp", "telefone", "nota", "atendimentoId", "atendente"]
  estilizarHeader(aba, headers)

  aba.getRange("C1").setNote("Escala: 1 Péssimo · 2 Ruim · 3 Regular · 4 Bom · 5 Ótimo")
  aba.getRange("E1").setNote("ID do atendente humano OU 'Bot'")

  // Validação nota 1-5
  const regraNota = SpreadsheetApp.newDataValidation()
    .requireNumberBetween(1, 5)
    .setAllowInvalid(false).build()
  aba.getRange("C2:C10000").setDataValidation(regraNota)

  // Formatação condicional por nota
  const cores = [
    { valor: 5, bg: "#DCFCE7", font: "#166534" },
    { valor: 4, bg: "#ECFDF5", font: "#065F46" },
    { valor: 3, bg: "#FEF9C3", font: "#854D0E" },
    { valor: 2, bg: "#FFEDD5", font: "#9A3412" },
    { valor: 1, bg: "#FEE2E2", font: "#991B1B" },
  ]
  const regras = cores.map(c =>
    SpreadsheetApp.newConditionalFormatRule()
      .whenNumberEqualTo(c.valor)
      .setBackground(c.bg)
      .setFontColor(c.font)
      .setRanges([aba.getRange("C2:C10000")])
      .build()
  )
  aba.setConditionalFormatRules(regras)

  aba.setColumnWidth(1, 200); aba.setColumnWidth(2, 160)
  aba.setColumnWidth(3, 80);  aba.setColumnWidth(4, 200)
  aba.setColumnWidth(5, 250)
  aba.setFrozenRows(1)
  return aba
}

function criarAbaBlacklistTenant(ss) {
  const aba = obterOuCriarAba(ss, "Blacklist")
  aba.clearContents().clearFormats()
  estilizarHeader(aba, ["telefone", "motivo", "atendente", "timestamp"])
  aba.setColumnWidth(1, 160); aba.setColumnWidth(2, 300)
  aba.setColumnWidth(3, 250); aba.setColumnWidth(4, 200)
  aba.setFrozenRows(1)
  return aba
}

function criarAbaConhecimento(ss) {
  const aba = obterOuCriarAba(ss, "Conhecimento")
  aba.clearContents().clearFormats()
  estilizarHeader(aba, ["pergunta", "resposta", "categoria", "data"])

  aba.getRange("A1").setNote(
    "Base de conhecimento do bot Ana Maria.\n" +
    "Injetada dinamicamente no system prompt do Gemini antes de cada atendimento.\n" +
    "Novas entradas são adicionadas via comando /responder no WhatsApp."
  )

  aba.setColumnWidth(1, 350); aba.setColumnWidth(2, 500)
  aba.setColumnWidth(3, 150); aba.setColumnWidth(4, 200)
  aba.setFrozenRows(1)
  return aba
}

function criarAbaLogErrosTenant(ss) {
  const aba = obterOuCriarAba(ss, "Log_Erros")
  aba.clearContents().clearFormats()
  estilizarHeader(aba, ["timestamp", "no", "erro", "telefone"])
  aba.setColumnWidth(1, 200); aba.setColumnWidth(2, 200)
  aba.setColumnWidth(3, 500); aba.setColumnWidth(4, 160)
  aba.setFrozenRows(1)
  return aba
}

function criarAbaPrimeirosContatos(ss) {
  const aba = obterOuCriarAba(ss, "Primeiros_Contatos")
  aba.clearContents().clearFormats()
  estilizarHeader(aba, ["telefone", "parceiro", "data", "status"])

  const regraStatus = SpreadsheetApp.newDataValidation()
    .requireValueInList(["pendente", "enviado", "respondeu", "converteu"])
    .setAllowInvalid(false).build()
  aba.getRange("D2:D10000").setDataValidation(regraStatus)

  aba.setColumnWidth(1, 160); aba.setColumnWidth(2, 200)
  aba.setColumnWidth(3, 200); aba.setColumnWidth(4, 120)
  aba.setFrozenRows(1)
  return aba
}

// ═══════════════════════════════════════════════════════════════
// UTILITÁRIOS
// ═══════════════════════════════════════════════════════════════

function obterOuCriarAba(ss, nome) {
  return ss.getSheetByName(nome) || ss.insertSheet(nome)
}

function estilizarHeader(aba, headers) {
  const range = aba.getRange(1, 1, 1, headers.length)
  range.setValues([headers])

  // Estilo visual
  range
    .setBackground(CONFIG.COR_HEADER)
    .setFontColor(CONFIG.COR_HEADER_FONT)
    .setFontWeight("bold")
    .setFontSize(11)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")

  aba.setRowHeight(1, 36)

  // Borda inferior destacada
  range.setBorder(
    null, null, true, null, null, null,
    CONFIG.COR_BORDA,
    SpreadsheetApp.BorderStyle.SOLID_MEDIUM
  )
}

function protegerAbas(ss) {
  try {
    // Protege a aba Usuarios contra edição acidental de colunas críticas
    const abaUsuarios = ss.getSheetByName("Usuarios")
    if (!abaUsuarios) return

    const protecao = abaUsuarios.getRange("D2:D1000").protect()
    protecao.setDescription("passwordHash — não edite manualmente")
    protecao.setWarningOnly(true)

    Logger.log("  ✓ Proteções aplicadas")
  } catch(e) {
    Logger.log("  ⚠ Proteções não aplicadas (sem permissão): " + e)
  }
}

// Gera UUID v4 simples (sem dependências externas)
function gerarUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === "x" ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

// ═══════════════════════════════════════════════════════════════
// MENU PERSONALIZADO
// Adiciona "AAD" no menu do Google Sheets ao abrir
// ═══════════════════════════════════════════════════════════════
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🤖 AAD")
    .addItem("Criar Planilha MASTER", "criarPlanilhaMaster")
    .addSeparator()
    .addItem("Criar Planilha de Tenant", "criarPlanilhaTenant")
    .addSeparator()
    .addItem("Ver ID desta planilha", "verID")
    .addToUi()
}

function verID() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()
  SpreadsheetApp.getUi().alert(
    "ID desta planilha:\n\n" + ss.getId() + "\n\n" +
    "Cole em GOOGLE_MASTER_SHEET_ID no arquivo .env.local"
  )
}
