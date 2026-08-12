-- ================================================================
-- ComAgente — Migration 008: TrackerMap — Importação Completa
-- 11 abas da planilha → tenant_trackermap
-- Execute no Supabase SQL Editor
-- ================================================================


-- ══════════════════════════════════════════════════════════════════
-- 1. Criar tabelas novas (não geradas pelo create_tenant_schema original)
-- ══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS tenant_trackermap.transcricoes (
  id          BIGSERIAL PRIMARY KEY,
  timestamp   TIMESTAMPTZ DEFAULT NOW(),
  telefone    TEXT DEFAULT '',
  nome        TEXT DEFAULT '',
  intencao    TEXT DEFAULT '',
  sentimento  TEXT DEFAULT '',
  transcricao TEXT DEFAULT '',
  preview     TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS tenant_trackermap.instancia (
  id         BIGSERIAL PRIMARY KEY,
  empresa    TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_trackermap.primeiros_contatos (
  id         BIGSERIAL PRIMARY KEY,
  telefone   TEXT NOT NULL DEFAULT '',
  parceiro   TEXT DEFAULT '',
  data       TIMESTAMPTZ DEFAULT NOW(),
  status     TEXT DEFAULT 'aguardando',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_trackermap.conhecimento (
  id         BIGSERIAL PRIMARY KEY,
  pergunta   TEXT NOT NULL DEFAULT '',
  resposta   TEXT NOT NULL DEFAULT '',
  categoria  TEXT DEFAULT 'geral',
  data       TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active  BOOLEAN DEFAULT true,
  UNIQUE(pergunta)
);


-- ══════════════════════════════════════════════════════════════════
-- 2. Adicionar coluna CPJ específica da TrackerMap em clientes
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE tenant_trackermap.clientes ADD COLUMN IF NOT EXISTS cpj TEXT DEFAULT '';


-- ══════════════════════════════════════════════════════════════════
-- 3. Instância — aba "Instância"
-- ══════════════════════════════════════════════════════════════════

INSERT INTO tenant_trackermap.instancia (empresa)
VALUES ('TrackerMap')
ON CONFLICT DO NOTHING;


-- ══════════════════════════════════════════════════════════════════
-- 4. Clientes — 26 registros
-- Mapeamento: telefone, nome, status, Data→ultimo_contato,
--             Historico_Recente→historico, Intensçao→tags, CPJ→cpj
-- ══════════════════════════════════════════════════════════════════

INSERT INTO tenant_trackermap.clientes
  (telefone, nome, status, ultimo_contato, historico, tags, cpj, origem)
VALUES
  ('557188671358',  'Alice',               'Com contrato', TO_TIMESTAMP('08/03/2026', 'DD/MM/YYYY'), 'INSERIDO PELO ADM', 'CADASTRO', '2563', 'WhatsApp'),
  ('557791378958',  'Antonio',             'Com contrato', TO_TIMESTAMP('08/08/2026 21:10:40', 'DD/MM/YYYY HH24:MI:SS'), 'Ta marcando em casa mas ela não estar', 'outro', '1589', 'WhatsApp'),
  ('557181020453',  'Evangelista',         'Com contrato', TO_TIMESTAMP('08/03/2026', 'DD/MM/YYYY'), 'INSERIDO PELO ADM', 'CADASTRO', '9564', 'WhatsApp'),
  ('557182506178',  'Gian',                'Com contrato', TO_TIMESTAMP('08/03/2026', 'DD/MM/YYYY'), 'INSERIDO PELO ADM', 'CADASTRO', '3506', 'WhatsApp'),
  ('557186358260',  'Helio',               'Com contrato', TO_TIMESTAMP('08/03/2026', 'DD/MM/YYYY'), 'INSERIDO PELO ADM', 'CADASTRO', '530',  'WhatsApp'),
  ('557183067954',  'Joan',                'Com contrato', TO_TIMESTAMP('08/03/2026', 'DD/MM/YYYY'), 'INSERIDO PELO ADM', 'CADASTRO', '1505', 'WhatsApp'),
  ('557192308143',  'Jonatas',             'Com contrato', TO_TIMESTAMP('08/03/2026', 'DD/MM/YYYY'), 'INSERIDO PELO ADM', 'CADASTRO', '1504', 'WhatsApp'),
  ('557182116074',  'José',                'Com contrato', TO_TIMESTAMP('08/03/2026', 'DD/MM/YYYY'), 'INSERIDO PELO ADM', 'CADASTRO', '5538', 'WhatsApp'),
  ('557191045869',  'JOSE',                'Com contrato', TO_TIMESTAMP('08/03/2026', 'DD/MM/YYYY'), 'INSERIDO PELO ADM', 'CADASTRO', '6584', 'WhatsApp'),
  ('557199117987',  'Joselita',            'Com contrato', TO_TIMESTAMP('08/03/2026', 'DD/MM/YYYY'), 'INSERIDO PELO ADM', 'CADASTRO', '3540', 'WhatsApp'),
  ('557191952970',  'Josilene',            'Com contrato', TO_TIMESTAMP('08/03/2026', 'DD/MM/YYYY'), 'INSERIDO PELO ADM', 'CADASTRO', '4585', 'WhatsApp'),
  ('557192314254',  'Leandro',             'Com contrato', TO_TIMESTAMP('08/03/2026', 'DD/MM/YYYY'), 'INSERIDO PELO ADM', 'CADASTRO', '9507', 'WhatsApp'),
  ('557188660844',  'Lucas',               'Com contrato', TO_TIMESTAMP('08/03/2026', 'DD/MM/YYYY'), 'INSERIDO PELO ADM', 'CADASTRO', '9533', 'WhatsApp'),
  ('557192474355',  'Mariane',             'Com contrato', TO_TIMESTAMP('08/03/2026', 'DD/MM/YYYY'), 'INSERIDO PELO ADM', 'CADASTRO', '3505', 'WhatsApp'),
  ('557181837847',  'Matheus',             'Com contrato', TO_TIMESTAMP('08/03/2026', 'DD/MM/YYYY'), 'INSERIDO PELO ADM', 'CADASTRO', '9502', 'WhatsApp'),
  ('557198383974',  'PLANO VIDA IMPERIAL', 'Com contrato', TO_TIMESTAMP('08/03/2026', 'DD/MM/YYYY'), 'INSERIDO PELO ADM', 'CADASTRO', '199',  'WhatsApp'),
  ('557191348945',  'Robert',              'Com contrato', TO_TIMESTAMP('08/03/2026', 'DD/MM/YYYY'), 'INSERIDO PELO ADM', 'CADASTRO', '7588', 'WhatsApp'),
  ('557182864272',  'Willian',             'Com contrato', TO_TIMESTAMP('08/03/2026', 'DD/MM/YYYY'), 'INSERIDO PELO ADM', 'CADASTRO', '2518', 'WhatsApp'),
  ('557196327327',  'Felipe',              'Com contrato', TO_TIMESTAMP('08/03/2026', 'DD/MM/YYYY'), 'INSERIDO PELO ADM', 'CADASTRO', '8598', 'WhatsApp'),
  ('557199970389',  'Maique',              'Com contrato', TO_TIMESTAMP('16/05/2026', 'DD/MM/YYYY'), 'Cliente confirmou que quer o link para o Plano Premium', '', '', 'WhatsApp'),
  ('557196938973',  'Pedro Junior',        'Com contrato', TO_TIMESTAMP('16/05/2026', 'DD/MM/YYYY'), 'Pra mim mesmo', '', '', 'WhatsApp'),
  ('557188968579',  'Alice Bolfe',         'Com contrato', TO_TIMESTAMP('19/05/2026', 'DD/MM/YYYY'), 'Olá, boa tarde!', '', '', 'WhatsApp'),
  ('557192588193',  'Camila Neves',        'Com contrato', TO_TIMESTAMP('17/05/2026', 'DD/MM/YYYY'), 'Cliente agradeceu', '', '', 'WhatsApp'),
  ('557191687574',  'Ruan',                'Com contrato', TO_TIMESTAMP('06/04/2026', 'DD/MM/YYYY'), 'O cliente informa que fez a troca do relê, mas o bloqueio continua sem funcionar', '', '', 'WhatsApp'),
  ('5516994985975', 'Atendimento Canecas', 'desconhecido', TO_TIMESTAMP('11/08/2026 13:53:08', 'DD/MM/YYYY HH24:MI:SS'), 'Oi', 'saudacao', '', 'WhatsApp'),
  ('557184298303',  'Salmos 37:4',         'desconhecido', TO_TIMESTAMP('08/08/2026 15:04:16', 'DD/MM/YYYY HH24:MI:SS'), 'O cliente está aguardando uma resposta após consulta', 'duvida', '', 'WhatsApp')
ON CONFLICT (telefone) DO UPDATE SET
  nome          = EXCLUDED.nome,
  status        = EXCLUDED.status,
  ultimo_contato = EXCLUDED.ultimo_contato,
  historico     = EXCLUDED.historico,
  tags          = EXCLUDED.tags,
  cpj           = EXCLUDED.cpj;


-- ══════════════════════════════════════════════════════════════════
-- 5. Transcrições — 23 registros (aba "Atendimentos")
-- ══════════════════════════════════════════════════════════════════

INSERT INTO tenant_trackermap.transcricoes (timestamp, telefone, nome, intencao, sentimento, transcricao, preview)
VALUES
  (TO_TIMESTAMP('02/08/2026 08:19:15','DD/MM/YYYY HH24:MI:SS'), '5516994985975', 'Atendimento Canecas', 'saudacao', 'neutro',   'Mensagem de identificação do sistema.',                                                    'Mensagem de identificação do sistema.'),
  (TO_TIMESTAMP('02/08/2026 13:47:52','DD/MM/YYYY HH24:MI:SS'), '5516994985975', 'Atendimento Canecas', 'saudacao', 'neutro',   'Mensagem de sistema/teste.',                                                               'Mensagem de sistema/teste.'),
  (TO_TIMESTAMP('03/08/2026 03:24:45','DD/MM/YYYY HH24:MI:SS'), '5516994985975', 'Atendimento Canecas', 'saudacao', 'neutro',   'Cliente iniciou o contato sem nome.',                                                      'Cliente iniciou o contato sem nome.'),
  (TO_TIMESTAMP('03/08/2026 03:25:34','DD/MM/YYYY HH24:MI:SS'), '5516994985975', 'Atendimento Canecas', 'saudacao', 'neutro',   'Cliente enviou a mesma mensagem sem identificação novamente.',                             'Cliente enviou a mesma mensagem sem identificação novamente.'),
  (TO_TIMESTAMP('03/08/2026 03:26:13','DD/MM/YYYY HH24:MI:SS'), '5516994985975', 'Atendimento Canecas', 'saudacao', 'neutro',   'Cliente enviou a mesma mensagem pela terceira vez sem se identificar.',                    'Cliente enviou a mesma mensagem pela terceira vez sem se identificar.'),
  (TO_TIMESTAMP('03/08/2026 03:27:19','DD/MM/YYYY HH24:MI:SS'), '5516994985975', 'Atendimento Canecas', 'saudacao', 'neutro',   'Cliente enviou a mesma mensagem pela quarta vez sem se identificar.',                      'Cliente enviou a mesma mensagem pela quarta vez sem se identificar.'),
  (TO_TIMESTAMP('03/08/2026 03:34:04','DD/MM/YYYY HH24:MI:SS'), '5516994985975', 'Atendimento Canecas', 'saudacao', 'neutro',   'Cliente enviou a mesma mensagem pela quinta vez sem se identificar.',                      'Cliente enviou a mesma mensagem pela quinta vez sem se identificar.'),
  (TO_TIMESTAMP('03/08/2026 03:34:51','DD/MM/YYYY HH24:MI:SS'), '5516994985975', 'Atendimento Canecas', 'saudacao', 'neutro',   'Cliente enviou a mesma mensagem pela sexta vez sem se identificar.',                       'Cliente enviou a mesma mensagem pela sexta vez sem se identificar.'),
  (TO_TIMESTAMP('03/08/2026 03:38:26','DD/MM/YYYY HH24:MI:SS'), '5516994985975', 'Atendimento Canecas', 'saudacao', 'neutro',   'Cliente enviou a mesma mensagem pela sétima vez sem se identificar.',                      'Cliente enviou a mesma mensagem pela sétima vez sem se identificar.'),
  (TO_TIMESTAMP('03/08/2026 03:40:17','DD/MM/YYYY HH24:MI:SS'), '5516994985975', 'Atendimento Canecas', 'saudacao', 'neutro',   'Cliente enviou a mensagem pela oitava vez sem se identificar.',                            'Cliente enviou a mensagem pela oitava vez sem se identificar.'),
  (TO_TIMESTAMP('03/08/2026 03:43:08','DD/MM/YYYY HH24:MI:SS'), '5516994985975', 'Atendimento Canecas', 'saudacao', 'neutro',   'Cliente enviou a mensagem pela nona vez sem se identificar.',                              'Cliente enviou a mensagem pela nona vez sem se identificar.'),
  (TO_TIMESTAMP('03/08/2026 03:43:57','DD/MM/YYYY HH24:MI:SS'), '5516994985975', 'Atendimento Canecas', 'saudacao', 'neutro',   'Cliente enviou a mensagem pela décima vez sem se identificar.',                            'Cliente enviou a mensagem pela décima vez sem se identificar.'),
  (TO_TIMESTAMP('03/08/2026 03:46:14','DD/MM/YYYY HH24:MI:SS'), '5516994985975', 'Atendimento Canecas', 'saudacao', 'neutro',   'Cliente enviou a mensagem pela décima primeira vez sem se identificar.',                   'Cliente enviou a mensagem pela décima primeira vez sem se identificar.'),
  (TO_TIMESTAMP('03/08/2026 03:53:18','DD/MM/YYYY HH24:MI:SS'), '5516994985975', 'Atendimento Canecas', 'saudacao', 'neutro',   'Cliente enviou uma saudação novamente sem se identificar.',                                'Cliente enviou uma saudação novamente sem se identificar.'),
  (TO_TIMESTAMP('03/08/2026 03:53:48','DD/MM/YYYY HH24:MI:SS'), '5516994985975', 'Atendimento Canecas', 'interesse','positivo', 'Cliente informou o nome: Paulo.',                                                          'Cliente informou o nome: Paulo.'),
  (TO_TIMESTAMP('03/08/2026 03:55:18','DD/MM/YYYY HH24:MI:SS'), '5516994985975', 'Atendimento Canecas', 'humano',   'neutro',   'Cliente solicitou falar com um atendente.',                                                'Cliente solicitou falar com um atendente.'),
  (TO_TIMESTAMP('05/08/2026 12:56:38','DD/MM/YYYY HH24:MI:SS'), '5516994985975', 'Atendimento Canecas', 'saudacao', 'neutro',   'Saudação inicial',                                                                         'Saudação inicial'),
  (TO_TIMESTAMP('06/08/2026 03:05:50','DD/MM/YYYY HH24:MI:SS'), '5516994985975', 'Atendimento Canecas', 'saudacao', 'positivo', 'Olá',                                                                                      'Olá'),
  (TO_TIMESTAMP('08/08/2026 15:02:43','DD/MM/YYYY HH24:MI:SS'), '557184298303',  'Salmos 37:4',         'duvida',   'neutro',   'O cliente pergunta como é feita a instalação do rastreador.',                              'O cliente pergunta como é feita a instalação do rastreador.'),
  (TO_TIMESTAMP('08/08/2026 15:04:18','DD/MM/YYYY HH24:MI:SS'), '557184298303',  'Salmos 37:4',         'duvida',   'neutro',   'O cliente está aguardando uma resposta após a consulta à gerente.',                        'O cliente está aguardando uma resposta após a consulta à gerente.'),
  (TO_TIMESTAMP('08/08/2026 21:09:27','DD/MM/YYYY HH24:MI:SS'), '557791378958',  'Antonio',             'saudacao', 'neutro',   'Boa Noite',                                                                                'Boa Noite'),
  (TO_TIMESTAMP('08/08/2026 21:10:07','DD/MM/YYYY HH24:MI:SS'), '557791378958',  'Antonio',             'outro',    'neutro',   'Atualizar o GPS da moto',                                                                  'Atualizar o GPS da moto'),
  (TO_TIMESTAMP('08/08/2026 21:10:42','DD/MM/YYYY HH24:MI:SS'), '557791378958',  'Antonio',             'outro',    'negativo', 'Ta marcando em casa mas ela não estar',                                                    'Ta marcando em casa mas ela não estar');


-- ══════════════════════════════════════════════════════════════════
-- 6. Satisfação — 2 registros
-- ══════════════════════════════════════════════════════════════════

INSERT INTO tenant_trackermap.satisfacao (timestamp, telefone, nota, atendimento_id, atendente)
SELECT TO_TIMESTAMP('03/08/2026 03:32:32','DD/MM/YYYY HH24:MI:SS'), '5516994985975', 5, '5516994985975_1785738752748', '557181914361'
WHERE NOT EXISTS (SELECT 1 FROM tenant_trackermap.satisfacao WHERE atendimento_id = '5516994985975_1785738752748');

INSERT INTO tenant_trackermap.satisfacao (timestamp, telefone, nota, atendimento_id, atendente)
SELECT TO_TIMESTAMP('03/08/2026 03:52:41','DD/MM/YYYY HH24:MI:SS'), '5516994985975', 4, '5516994985975_1785739961628', '557181914361'
WHERE NOT EXISTS (SELECT 1 FROM tenant_trackermap.satisfacao WHERE atendimento_id = '5516994985975_1785739961628');


-- ══════════════════════════════════════════════════════════════════
-- 7. Primeiros Contatos — 4 registros
-- ══════════════════════════════════════════════════════════════════

INSERT INTO tenant_trackermap.primeiros_contatos (telefone, parceiro, data, status)
SELECT '557181153749', 'Rogério', TO_TIMESTAMP('03/08/2026 14:52:17','DD/MM/YYYY HH24:MI:SS'), 'aguardando'
WHERE NOT EXISTS (SELECT 1 FROM tenant_trackermap.primeiros_contatos WHERE telefone = '557181153749' AND data = TO_TIMESTAMP('03/08/2026 14:52:17','DD/MM/YYYY HH24:MI:SS'));

INSERT INTO tenant_trackermap.primeiros_contatos (telefone, parceiro, data, status)
SELECT '557181153749', 'Rogério', TO_TIMESTAMP('05/08/2026 14:30:27','DD/MM/YYYY HH24:MI:SS'), 'aguardando'
WHERE NOT EXISTS (SELECT 1 FROM tenant_trackermap.primeiros_contatos WHERE telefone = '557181153749' AND data = TO_TIMESTAMP('05/08/2026 14:30:27','DD/MM/YYYY HH24:MI:SS'));

INSERT INTO tenant_trackermap.primeiros_contatos (telefone, parceiro, data, status)
SELECT '557181153749', 'Rogério', TO_TIMESTAMP('10/08/2026 09:42:01','DD/MM/YYYY HH24:MI:SS'), 'aguardando'
WHERE NOT EXISTS (SELECT 1 FROM tenant_trackermap.primeiros_contatos WHERE telefone = '557181153749' AND data = TO_TIMESTAMP('10/08/2026 09:42:01','DD/MM/YYYY HH24:MI:SS'));

INSERT INTO tenant_trackermap.primeiros_contatos (telefone, parceiro, data, status)
SELECT '557181914361', 'Rogério', TO_TIMESTAMP('10/08/2026 09:42:33','DD/MM/YYYY HH24:MI:SS'), 'aguardando'
WHERE NOT EXISTS (SELECT 1 FROM tenant_trackermap.primeiros_contatos WHERE telefone = '557181914361' AND data = TO_TIMESTAMP('10/08/2026 09:42:33','DD/MM/YYYY HH24:MI:SS'));


-- ══════════════════════════════════════════════════════════════════
-- 8. Fila Humana — 1 registro ativo
-- Mapeamento: Status→motivo, Atendente→nome, Timestamp→created_at
-- ══════════════════════════════════════════════════════════════════

INSERT INTO tenant_trackermap.fila_humana (telefone, nome, motivo, created_at)
SELECT '5516994985975', 'ComAgente - Rogério', 'pausado', '2026-08-11 13:56:01'
WHERE NOT EXISTS (SELECT 1 FROM tenant_trackermap.fila_humana WHERE telefone = '5516994985975');


-- ══════════════════════════════════════════════════════════════════
-- Log_Erros — 120 linhas todas vazias, ignoradas
-- Agendamentos — vazia (0 registros)
-- Conhecimento — vazia (0 registros)
-- Blacklist — vazia (0 registros)
-- Usuarios — mesmos da Lucena, já existem em app.usuarios
-- ══════════════════════════════════════════════════════════════════


-- ══════════════════════════════════════════════════════════════════
-- Verificação Final
-- ══════════════════════════════════════════════════════════════════
SELECT 'tenant_trackermap.instancia'          AS tabela, COUNT(*) AS total FROM tenant_trackermap.instancia          UNION ALL
SELECT 'tenant_trackermap.clientes'           AS tabela, COUNT(*) AS total FROM tenant_trackermap.clientes           UNION ALL
SELECT 'tenant_trackermap.transcricoes'       AS tabela, COUNT(*) AS total FROM tenant_trackermap.transcricoes       UNION ALL
SELECT 'tenant_trackermap.satisfacao'         AS tabela, COUNT(*) AS total FROM tenant_trackermap.satisfacao         UNION ALL
SELECT 'tenant_trackermap.primeiros_contatos' AS tabela, COUNT(*) AS total FROM tenant_trackermap.primeiros_contatos UNION ALL
SELECT 'tenant_trackermap.fila_humana'        AS tabela, COUNT(*) AS total FROM tenant_trackermap.fila_humana        UNION ALL
SELECT 'tenant_trackermap.conhecimento'       AS tabela, COUNT(*) AS total FROM tenant_trackermap.conhecimento       UNION ALL
SELECT 'tenant_trackermap.agendamentos'       AS tabela, COUNT(*) AS total FROM tenant_trackermap.agendamentos       UNION ALL
SELECT 'tenant_trackermap.blacklist'          AS tabela, COUNT(*) AS total FROM tenant_trackermap.blacklist          UNION ALL
SELECT 'tenant_trackermap.log_erros'          AS tabela, COUNT(*) AS total FROM tenant_trackermap.log_erros;
