// ══════════════════════════════════════════════════════════════
// AAD — Registrar Lucena Decorações como Tenant
//
// COMO USAR:
// 1. Abra a planilha MASTER (ComAgente — Master)
// 2. Vá em 🤖 AAD → Apps Script (ou Extensões → Apps Script)
// 3. Cole este código e execute: registrarLucenaDecoracoes()
// ══════════════════════════════════════════════════════════════

function registrarLucenaDecoracoes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet()

  // ── 1. Registra tenant na aba Empresas ──────────────────────
  const abaEmpresas = ss.getSheetByName("Empresas")
  if (!abaEmpresas) {
    SpreadsheetApp.getUi().alert("❌ Aba 'Empresas' não encontrada. Execute criarPlanilhaMaster() primeiro.")
    return
  }

  // Remove linha de exemplo se ainda existir
  const dadosEmpresas = abaEmpresas.getDataRange().getValues()
  for (let i = dadosEmpresas.length - 1; i >= 1; i--) {
    if (dadosEmpresas[i][0].toString().startsWith("#")) {
      abaEmpresas.deleteRow(i + 1)
    }
  }

  // Busca o ID do primeiro plano cadastrado (Professional por padrão)
  const abaPlanos = ss.getSheetByName("Planos")
  let planId = ""
  if (abaPlanos && abaPlanos.getLastRow() >= 2) {
    // Pega o segundo plano (Professional — index 1)
    const linhasPlanos = abaPlanos.getRange(2, 1, abaPlanos.getLastRow() - 1, 2).getValues()
    planId = linhasPlanos.length > 1 ? linhasPlanos[1][0] : linhasPlanos[0][0]
  }

  const tenantId = "1fvrlD2raZxlVyzhLGPxoY7cRJiq1iUwwdwO3d-vMBOA"
  const agora    = new Date().toISOString()

  // Verifica se já existe
  const dadosAtuais = abaEmpresas.getDataRange().getValues()
  const jaExiste    = dadosAtuais.some(row => row[0] === tenantId)

  if (!jaExiste) {
    abaEmpresas.appendRow([
      tenantId,                        // id (= spreadsheetId da planilha do tenant)
      "Lucena Decorações",             // name
      "contato@lucenadecoracoes.com.br", // email — atualize conforme necessário
      "",                              // phone — preencha depois
      planId,                          // planId
      "trial",                         // status inicial
      agora,                           // createdAt
      "",                              // evolutionInstance — preencha depois
    ])
    Logger.log("✅ Lucena Decorações adicionada à aba Empresas")
  } else {
    Logger.log("⚠ Lucena Decorações já existe na aba Empresas")
  }

  // ── 2. Cria Supervisor na planilha do tenant ─────────────────
  // Abre a planilha do tenant
  let ssTenant
  try {
    ssTenant = SpreadsheetApp.openById(tenantId)
  } catch(e) {
    SpreadsheetApp.getUi().alert(
      "⚠ Não foi possível abrir a planilha do tenant.\n\n" +
      "Verifique se o Service Account tem acesso à planilha:\n" +
      "1fvrlD2raZxlVyzhLGPxoY7cRJiq1iUwwdwO3d-vMBOA\n\n" +
      "Erro: " + e.message
    )
    return
  }

  const abaUsuariosTenant = ssTenant.getSheetByName("Usuarios")
  if (!abaUsuariosTenant) {
    SpreadsheetApp.getUi().alert("❌ Aba 'Usuarios' não encontrada na planilha do tenant.")
    return
  }

  // Verifica se já tem supervisor cadastrado
  const dadosUsuarios = abaUsuariosTenant.getLastRow()
  if (dadosUsuarios <= 1) {
    // Hash bcrypt de "Lucena@2026" — TROQUE no primeiro login
    // Gere em: https://bcrypt-generator.com (rounds: 12)
    const senhaHash = "$2a$12$Kix4hvDynCI.9lBNXdlrK.xYzPZMB2fKLqkAHiA2hM4t5GKlMkdpq"

    abaUsuariosTenant.appendRow([
      gerarUUID(),          // id
      tenantId,             // tenantId
      "supervisor@lucenadecoracoes.com.br", // email — atualize
      senhaHash,            // passwordHash (senha padrão: Admin@1234)
      "Supervisor Lucena",  // name
      "supervisor",         // role
      "",                   // phone
      true,                 // canViewDashboard
      true,                 // canViewCRM
      true,                 // canViewTranscricoes
      true,                 // canViewSatisfacao
      agora,                // createdAt
      true,                 // isActive
    ])
    Logger.log("✅ Supervisor criado na planilha do tenant")
  } else {
    Logger.log("⚠ Planilha do tenant já tem usuários cadastrados")
  }

  // ── 3. Resumo final ──────────────────────────────────────────
  SpreadsheetApp.getUi().alert(
    "✅ Lucena Decorações configurada!\n\n" +
    "📋 Tenant ID: " + tenantId + "\n\n" +
    "🔑 Credenciais iniciais do Supervisor:\n" +
    "E-mail: supervisor@lucenadecoracoes.com.br\n" +
    "Senha: Admin@1234\n\n" +
    "⚠ IMPORTANTE:\n" +
    "1. Atualize o e-mail e telefone na aba Empresas\n" +
    "2. Troque a senha no primeiro login\n" +
    "3. Preencha a instância Evolution API quando disponível\n" +
    "4. Mude o status de 'trial' para 'active' quando assinar"
  )
}

// UUID helper (mesma função do script principal)
function gerarUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === "x" ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}
