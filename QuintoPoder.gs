/**
 * @file QuintoPoder.gs
 * @description Lógica do "Quinto Poder" e agregação de tendências mediáticas.
 *              Atua como mecanismo de auditoria descentralizada (crowdsourcing).
 *              Além da tendenciosidade partidária, mede:
 *              - Auditoria de OMISSÃO: o que a mídia silencia.
 *              - Índice de NORMALIZAÇÃO: reprodução de eufemismos do mercado.
 * @module Módulo6_Gatilhos_QuintoPoder
 * @version 3.0.0
 * @date 2026-04-30
 */

/**
 * Agrega a tendência de uma notícia submetida pela comunidade.
 * @param {string} urlNoticia A URL da notícia publicada na imprensa.
 * @param {string} perfilId O UUID do perfil do usuário que submeteu/avaliou.
 * @param {Object} evaluations Avaliações da comunidade.
 */
function aggregateTendency(urlNoticia, perfilId, evaluations) {
  if (!urlNoticia || !perfilId || !evaluations) {
    logError('Parâmetros inválidos para aggregateTendency.', 'QuintoPoder');
    return;
  }

  try {
    const sheet = getSheet(SHEET_NAMES.NOTICIAS);
    const tendencyScore = calculateTendencyScore(evaluations);
    const omissionScore = calculateOmissionScore(evaluations);
    const normalizationIndex = calculateNormalizationIndex(evaluations);
    
    sheet.appendRow([
      urlNoticia, tendencyScore, omissionScore,
      normalizationIndex, perfilId, new Date()
    ]);
    
    logEvent('Tendência agregada: viés=' + tendencyScore +
      ', omissão=' + omissionScore +
      ', normalização=' + normalizationIndex, 'QuintoPoder');
  } catch (e) {
    logError('Erro ao agregar tendência: ' + e.message, 'QuintoPoder');
  }
}

/**
 * Calcula o score de tendenciosidade partidária de uma notícia.
 * @param {Object} evaluations Avaliações (omissões e destaques desproporcionais).
 * @return {number} Score (0 = Factual, >0 = Enviesada).
 */
function calculateTendencyScore(evaluations) {
  const focoEsquerda = Number(evaluations.focoEsquerda) || 0;
  const focoDireita = Number(evaluations.focoDireita) || 0;
  const omissaoEsquerda = Number(evaluations.omissaoEsquerda) || 0;
  const omissaoDireita = Number(evaluations.omissaoDireita) || 0;

  const biasDireita = focoDireita + omissaoEsquerda;
  const biasEsquerda = focoEsquerda + omissaoDireita;
  const biasTotal = Math.abs(biasDireita - biasEsquerda);
  
  return Math.min(10, biasTotal / 2);
}

/**
 * Calcula o score de OMISSÃO SISTÊMICA de uma notícia.
 * Mede se a reportagem ignora a cumplicidade estrutural do mercado
 * (auditoras, agências de risco, Anbima, bancos distribuidores).
 *
 * A reportagem da Piauí demonstra que a Faria Lima "tolerava, absorvia
 * e reorganizava as ilegalidades". Se uma notícia reduz o escândalo a
 * "governo A vs governo B" sem mencionar essa simbiose, o score sobe.
 *
 * @param {Object} evaluations Avaliações da comunidade qualificada.
 * @return {number} Score de omissão sistêmica (0 = completa, 10 = total omissão).
 */
function calculateOmissionScore(evaluations) {
  // Cada item mede se a notícia abordou uma dimensão sistêmica
  const mencionaAuditoras    = Number(evaluations.mencionaAuditoras) || 0;
  const mencionaAgenciasRisco = Number(evaluations.mencionaAgenciasRisco) || 0;
  const mencionaAnbima       = Number(evaluations.mencionaAnbima) || 0;
  const mencionaDistribuidores = Number(evaluations.mencionaDistribuidores) || 0;
  const mencionaSilencioMercado = Number(evaluations.mencionaSilencioMercado) || 0;

  // Score invertido: quanto MENOS a notícia menciona, MAIS o score sobe
  // Cada item avaliado de 0 (não menciona) a 10 (cobertura completa)
  const totalCobertura = mencionaAuditoras + mencionaAgenciasRisco +
    mencionaAnbima + mencionaDistribuidores + mencionaSilencioMercado;
  const maxCobertura = 50; // 5 itens × 10

  // Inverte: cobertura zero → omissão máxima (10)
  return Math.min(10, ((maxCobertura - totalCobertura) / maxCobertura) * 10);
}

/**
 * Calcula o índice de NORMALIZAÇÃO de eufemismos.
 * Mede se a reportagem reproduz o vocabulário sanitizado do mercado
 * (ex: "assimetria informacional" em vez de "fraude contábil",
 *  "gerenciamento inadequado de risco" em vez de "lavagem de dinheiro").
 *
 * A Piauí documenta que "na Faria Lima, o crime de lavagem de dinheiro
 * não costuma ser chamado pelo que é".
 *
 * @param {Object} evaluations Avaliações da comunidade qualificada.
 * @return {number} Índice (0 = linguagem direta, 10 = reproduz eufemismos).
 */
function calculateNormalizationIndex(evaluations) {
  const usaEufemismos = Number(evaluations.usaEufemismos) || 0;
  const nomeiaCrimes  = Number(evaluations.nomeiaCrimes) || 0;

  // Se usa eufemismos e não nomeia crimes, índice alto
  return Math.min(10, Math.max(0, usaEufemismos - nomeiaCrimes));
}

/**
 * Gera um dashboard público HTML para o 'Quinto Poder'.
 * @return {HtmlOutput} A interface de usuário do dashboard público.
 */
function generateQuintoPoderDashboard() {
  return HtmlService.createTemplateFromFile('Dashboard')
      .evaluate()
      .setTitle('Dashboard Quinto Poder - Auditoria Epistêmica')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

