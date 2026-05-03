/**
 * @file Facts.gs
 * @description Gerenciamento dos fatos confirmados do escândalo Banco Master.
 *              A aba Fatos armazena declarações factuais com peso intrínseco
 *              invisível e classificação ideológica (ESQUERDA/DIREITA/NEUTRO).
 * @module Módulo4_Gamificacao
 * @version 2.0.0
 * @date 2026-03-15
 */

/**
 * Retorna todos os fatos confirmados como array de objetos estruturados.
 * Operação em lote: carrega tudo via getDataRange().getValues().
 * @return {Array<Object>} Lista de fatos {id, text, weight, ideology}.
 */
function getConfirmedFacts() {
  const data = getSheet(SHEET_NAMES.FATOS).getDataRange().getValues();
  return data.slice(1).map(function(row) {
    return {
      id:       row[0],
      text:     row[1],
      weight:   Number(row[2]),
      ideology: row[3]
    };
  });
}

/**
 * Adiciona um novo fato confirmado à aba Fatos com validação.
 * @param {string} id O ID único do fato (ex: F1, F2...).
 * @param {string} text O texto descritivo factual verificado.
 * @param {number} weight O peso intrínseco invisível ao usuário (1–10).
 * @param {string} ideology A classificação: ESQUERDA, DIREITA ou NEUTRO.
 */
function addConfirmedFact(id, text, weight, ideology) {
  if (!id || !text) {
    logError('ID e texto são obrigatórios para adicionar fato.', 'Facts');
    return;
  }
  if (!IDEOLOGY.hasOwnProperty(ideology)) {
    logError('Ideologia inválida: ' + ideology, 'Facts');
    return;
  }
  const clampedWeight = Math.max(LIMITS.SCALE_MIN, Math.min(LIMITS.SCALE_MAX, Number(weight)));
  getSheet(SHEET_NAMES.FATOS).appendRow([id, text, clampedWeight, ideology]);
  logEvent('Fato adicionado: ' + id, 'Facts');
}

/**
 * Inicializa a aba Fatos com os fatos canônicos extraídos do documento.
 * Utiliza setValues() em bloco (anti-pattern: appendRow em loop eliminado).
 * Os fatos espelham as declarações confirmadas por investigações da PF
 * e reportagens referenciadas no documento de ponderação epistêmica.
 */
function initializeFactsSheet() {
  const facts = [
    // ── CAMADA 1: Fatos Criminais Brutos (NEUTRO) ─────────────────────────
    ['F1',  'Vorcaro transferiu R$ 707 milhões para holding nas Ilhas Cayman durante negociações de venda do Master.',  10, IDEOLOGY.NEUTRO],
    ['F2',  'A Tirreno, empresa de fachada de Vorcaro, simulava contratos de crédito consignado inexistentes.',          10, IDEOLOGY.NEUTRO],
    ['F3',  'O Master emitiu ~R$ 50 bilhões em CDBs oferecendo até 140% do CDI, sem lastro real.',                      10, IDEOLOGY.NEUTRO],
    ['F4',  'Milícia privada "A Turma" foi usada para espionagem e intimidação de jornalistas e autoridades.',           10, IDEOLOGY.NEUTRO],
    ['F5',  'O BRB adquiriu entre R$ 12 bi e R$ 21,9 bi em carteiras de crédito falsificadas do Master.',               10, IDEOLOGY.NEUTRO],

    // ── CAMADA 2: Captura Institucional — Esquerda/Judiciário ─────────────
    ['F6',  'Escritório de Viviane Barci de Moraes possuía contrato de R$ 129 milhões com o Master.',                   10, IDEOLOGY.ESQUERDA],
    ['F7',  'Guido Mantega figurava como consultor estratégico do Master, recebendo R$ 1 milhão mensais.',              10, IDEOLOGY.ESQUERDA],
    ['F8',  'Ricardo Lewandowski admitiu receber R$ 5-6 milhões em consultoria para o banco.',                          10, IDEOLOGY.ESQUERDA],
    ['F9',  'Toffoli impôs sigilo e suspendeu diligências como relator; só se declarou suspeito após exposição.',        9, IDEOLOGY.ESQUERDA],
    ['F10', 'Maridt Participações (irmãos de Toffoli) recebeu ~R$ 35 mi de fundos ligados ao Master/Reag.',              9, IDEOLOGY.ESQUERDA],
    ['F11', 'Lula recebeu Vorcaro no Planalto a pedido de Mantega, na presença de cinco assessores.',                    9, IDEOLOGY.ESQUERDA],
    ['F12', 'Vorcaro enviou mensagens a Alexandre de Moraes no dia de sua prisão, chamando-a de "batida do Esteves".',   8, IDEOLOGY.ESQUERDA],
    ['F13', 'Otto Lobo, indicado por Lula para presidir a CVM, teve padrinhos como Alcolumbre, irmãos Batista e Vaccari.', 9, IDEOLOGY.ESQUERDA],

    // ── CAMADA 3: Captura Institucional — Direita/BC ──────────────────────
    ['F14', 'Campos Neto presidiu o BC enquanto patrimônio do Master saltou de R$ 3,7 bi para R$ 82 bi.',               10, IDEOLOGY.DIREITA],
    ['F15', 'Ciro Nogueira tentou aprovar emenda para quadruplicar a garantia do FGC (Emenda Master).',                 10, IDEOLOGY.DIREITA],
    ['F16', 'Fabiano Zettel (cunhado de Vorcaro) foi maior doador privado de campanhas de Bolsonaro e Tarcísio.',       10, IDEOLOGY.DIREITA],
    ['F17', 'Diretores do BC (Paulo Souza e Belline Santana) recebiam ao menos R$ 4 mi cada de Vorcaro.',               10, IDEOLOGY.DIREITA],
    ['F18', 'Campos Neto criou cargo de "chefe-adjunto" especificamente para manter Paulo Souza influente na área.',      9, IDEOLOGY.DIREITA],
    ['F19', 'João Pedro Nascimento (indicado por Flávio Bolsonaro) presidiu CVM com escassa familiaridade técnica.',      9, IDEOLOGY.DIREITA],
    ['F20', 'Rioprevidência (gov. Cláudio Castro, PL) foi exposta em ~R$ 1 bi; Amprev (Amapá, Alcolumbre) em R$ 400 mi.', 9, IDEOLOGY.DIREITA],

    // ── CAMADA 4: Cumplicidade Estrutural do Mercado (SISTEMICO) ──────────
    // Estes fatos revelam a simbiose entre crime e finanças.
    // São o verdadeiro teste: o usuário reconhece a culpa do SISTEMA?
    ['F21', 'A Reag movimentava dez fundos para lavar dinheiro de empresas ligadas ao PCC, na Faria Lima.',             10, IDEOLOGY.SISTEMICO],
    ['F22', 'A Anbima manteve o selo de boas práticas da Reag mesmo após 23 autuações e só o retirou na liquidação.',   10, IDEOLOGY.SISTEMICO],
    ['F23', 'A Faria Lima convivia bem com a Reag; sabia-se do crescimento não orgânico e das suspeitas.',               10, IDEOLOGY.SISTEMICO],
    ['F24', 'BTG posicionou-se para lucrar com qualquer desfecho: reteve R$ 600 mi do Credcesta e quis os melhores ativos.', 9, IDEOLOGY.SISTEMICO],
    ['F25', 'Na CEO Conference do BTG, Stuhlberger atacou programas sociais mas ignorou a pergunta sobre o Master.',      9, IDEOLOGY.SISTEMICO],
    ['F26', 'Esteves lembrou: "Há 1 trilhão de subsídio para nós aqui nessa sala, o subsídio ao rentista." A plateia não reagiu.', 10, IDEOLOGY.SISTEMICO],
    ['F27', 'KPMG e Galdino Advogados emitiram laudos que não apontaram problemas nos precatórios inflados do Master.',   9, IDEOLOGY.SISTEMICO],
    ['F28', 'Agências de risco ELEVARAM a nota do Master um ano antes de sua quebra.',                                    9, IDEOLOGY.SISTEMICO],
    ['F29', 'O diretor de compliance da Reag (Walter Martins Ferreira III) era proprietário de fundo de fachada da Planner.', 10, IDEOLOGY.SISTEMICO],
    ['F30', 'A Fictor Asset, que aplicou calote de R$ 6 bi, ainda mantém selo Anbima de boas práticas.',                 10, IDEOLOGY.SISTEMICO],
    ['F31', 'Quem denunciou as operações foi o sindicato dos bancários — não os bancos, não a CVM, não a Anbima.',        10, IDEOLOGY.SISTEMICO],
    ['F32', 'O Rhodonite, fundo usado para lavar dinheiro do PCC e inflar ativos do Master, continua em operação.',      10, IDEOLOGY.SISTEMICO],
    ['F33', 'A Planner, que ofereceu "fundo de prateleira" para quadrilha do PCC, herdou fundos dos Batista e do Master.', 9, IDEOLOGY.SISTEMICO],
    ['F34', 'A Reag deu guarida aos Batista (J&F) durante a Lava Jato, abrindo 7 fundos de ~R$ 18 bi.',                  9, IDEOLOGY.SISTEMICO],
    ['F35', 'Vorcaro praticamente destruiu a Oncoclínicas — rede que empregava 18% dos oncologistas do Brasil.',          10, IDEOLOGY.SISTEMICO],

    // ── CAMADA 5: Falha Institucional Transversal ─────────────────────────
    ['F36', 'A CVM tem 379 servidores (já teve 900+); orçamento caiu 70% na última década para ~R$ 20 mi/ano.',          10, IDEOLOGY.NEUTRO],
    ['F37', 'O BC enviou 9 ofícios ao Master em 2024 pedindo reestruturação, sem qualquer punição.',                       9, IDEOLOGY.NEUTRO],
    ['F38', 'André Mendonça, ao assumir relatoria, decretou prisão de Vorcaro e desmontou "A Turma".',                   10, IDEOLOGY.NEUTRO],
    ['F39', 'Na Faria Lima, o crime de lavagem de dinheiro é chamado de "gerenciamento inadequado de risco de liquidez".', 10, IDEOLOGY.SISTEMICO],
    ['F40', 'O presidente da Anbima declarou que "a Reag não pode ser considerada um player-chave do setor" — sendo a maior gestora.', 9, IDEOLOGY.SISTEMICO]
  ];

  const sheet = getSheet(SHEET_NAMES.FATOS);
  sheet.clear();

  // Escrita em bloco: cabeçalho + dados em uma única transação setValues()
  const header = [['ID', 'Fato', 'Peso', 'Ideologia']];
  const allData = header.concat(facts);
  sheet.getRange(1, 1, allData.length, 4).setValues(allData);

  logEvent('Aba Fatos inicializada com ' + facts.length + ' fatos (incluindo ' +
    facts.filter(function(f) { return f[3] === IDEOLOGY.SISTEMICO; }).length +
    ' fatos de cumplicidade sistêmica).', 'Facts');
}
