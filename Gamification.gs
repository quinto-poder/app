/**
 * @file Gamification.gs
 * @description Teste de estresse epistêmico e motor de gamificação.
 *              Seleciona aleatoriamente subconjuntos de fatos confirmados,
 *              calcula score de viés via abs(Peso_Esquerda − Peso_Direita),
 *              mede cumplicidade sistêmica (minimização de fatos SISTEMICO)
 *              e atribui badges digitais escalonados.
 * @module Módulo4_Gamificacao
 * @version 3.0.0
 * @date 2026-04-30
 */

/**
 * Embaralha um array usando o algoritmo Fisher-Yates.
 * Garante distribuição uniforme na seleção aleatória de fatos.
 * @param {Array} array O array a ser embaralhado.
 * @return {Array} O array embaralhado (modifica in-place e retorna).
 */
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
  return array;
}

/**
 * Gera um teste de estresse epistêmico com fatos selecionados aleatoriamente.
 * Seleciona até LIMITS.MAX_FACTS_PER_TEST fatos (padrão: 12) garantindo
 * representatividade de todos os espectros, incluindo SISTEMICO.
 *
 * @param {string} perfilId O UUID do perfil do usuário.
 * @return {Array<Object>} Lista de fatos selecionados para o teste.
 */
function generateTest(perfilId) {
  const facts = getConfirmedFacts();
  const maxFacts = Math.min(LIMITS.MAX_FACTS_PER_TEST, facts.length);

  if (maxFacts === 0) {
    logError('Nenhum fato disponível para gerar teste.', 'Gamification');
    return [];
  }

  // Separa por ideologia para garantir representatividade
  const esquerda  = facts.filter(function(f) { return f.ideology === IDEOLOGY.ESQUERDA; });
  const direita   = facts.filter(function(f) { return f.ideology === IDEOLOGY.DIREITA; });
  const neutro    = facts.filter(function(f) { return f.ideology === IDEOLOGY.NEUTRO; });
  const sistemico = facts.filter(function(f) { return f.ideology === IDEOLOGY.SISTEMICO; });

  // Embaralha cada grupo
  shuffleArray(esquerda);
  shuffleArray(direita);
  shuffleArray(neutro);
  shuffleArray(sistemico);

  // Distribuição: ~25% esquerda, ~25% direita, ~25% neutro, ~25% sistêmico
  // Os fatos SISTEMICO são o teste central: medem se o usuário reconhece
  // a cumplicidade estrutural do mercado (a tese da reportagem da Piauí).
  const quarter = Math.ceil(maxFacts / 4);
  const targetE = Math.min(quarter, esquerda.length);
  const targetD = Math.min(quarter, direita.length);
  const targetS = Math.min(quarter, sistemico.length);
  const remaining = maxFacts - targetE - targetD - targetS;
  const targetN = Math.min(remaining, neutro.length);

  let selected = esquerda.slice(0, targetE)
    .concat(direita.slice(0, targetD))
    .concat(sistemico.slice(0, targetS))
    .concat(neutro.slice(0, targetN));

  // Se ainda faltam fatos, completa com os que sobraram
  if (selected.length < maxFacts) {
    const usedIds = {};
    selected.forEach(function(f) { usedIds[f.id] = true; });
    const unused = facts.filter(function(f) { return !usedIds[f.id]; });
    shuffleArray(unused);
    selected = selected.concat(unused.slice(0, maxFacts - selected.length));
  }

  // Embaralha a ordem final (para que o usuário não perceba o balanceamento)
  shuffleArray(selected);

  logEvent('Teste gerado para ' + perfilId + ': ' + selected.length + ' fatos.', 'Gamification');
  return selected;
}

/**
 * Calcula o score de viés PARTIDÁRIO com base nos pesos ajustados pelo usuário.
 * Fórmula: score = abs(Peso_Esquerda − Peso_Direita)
 *
 * @param {Array<Object>} userAnswers Lista de {id, ideology, userWeight}.
 * @return {number} O score de viés partidário (valor absoluto).
 */
function calculateBiasScore(userAnswers) {
  let pesoEsquerda = 0;
  let pesoDireita = 0;

  userAnswers.forEach(function(answer) {
    const w = Number(answer.userWeight) || 0;
    if (answer.ideology === IDEOLOGY.ESQUERDA) {
      pesoEsquerda += w;
    } else if (answer.ideology === IDEOLOGY.DIREITA) {
      pesoDireita += w;
    }
    // Fatos NEUTROS e SISTEMICOS não entram na equação de viés partidário
  });

  return Math.abs(pesoEsquerda - pesoDireita);
}

/**
 * Calcula o índice de cumplicidade sistêmica.
 * Mede se o usuário minimiza fatos que revelam a simbiose entre
 * crime e finanças na Faria Lima (categoria SISTEMICO).
 *
 * Um usuário que atribui peso alto a fatos partidários mas peso baixo
 * a fatos SISTEMICO está praticando exatamente a cegueira que a
 * reportagem da Piauí denuncia: reduzir o problema a "esquerda vs direita"
 * enquanto ignora que o SISTEMA como um todo é cúmplice.
 *
 * @param {Array<Object>} userAnswers Lista de {id, ideology, userWeight}.
 * @return {number} Índice de cumplicidade (0 = reconhece, alto = minimiza).
 */
function calculateComplicityIndex(userAnswers) {
  let pesoPartidario = 0;
  let countPartidario = 0;
  let pesoSistemico = 0;
  let countSistemico = 0;

  userAnswers.forEach(function(answer) {
    const w = Number(answer.userWeight) || 0;
    if (answer.ideology === IDEOLOGY.ESQUERDA || answer.ideology === IDEOLOGY.DIREITA) {
      pesoPartidario += w;
      countPartidario++;
    } else if (answer.ideology === IDEOLOGY.SISTEMICO) {
      pesoSistemico += w;
      countSistemico++;
    }
  });

  // Médias normalizadas
  const mediaPartidaria = countPartidario > 0 ? pesoPartidario / countPartidario : 0;
  const mediaSistemica  = countSistemico > 0 ? pesoSistemico / countSistemico : 0;

  // Se o usuário atribui gravidade alta a fatos partidários mas baixa a
  // fatos sistêmicos, o índice sobe — revelando cegueira estrutural.
  // Se atribui gravidade proporcional, o índice tende a zero.
  return Math.max(0, mediaPartidaria - mediaSistemica);
}

/**
 * Atribui badges digitais ao usuário com base no score de viés
 * E no índice de cumplicidade sistêmica.
 * @param {number} biasScore O score de viés partidário.
 * @param {number} complicityIndex O índice de cumplicidade sistêmica.
 * @return {string} O badge desbloqueado.
 */
function unlockBadge(biasScore, complicityIndex) {
  // Cumplicidade alta = minimiza o problema sistêmico
  if (complicityIndex !== undefined && complicityIndex > 3) {
    return BADGES.COMPLICIT;
  }
  if (biasScore < BADGE_THRESHOLDS.ANALYST)  return BADGES.ANALYST;
  if (biasScore < BADGE_THRESHOLDS.MODERATE) return BADGES.MODERATE;
  if (biasScore < BADGE_THRESHOLDS.BIASED)   return BADGES.BIASED;
  return BADGES.BLIND;
}

/**
 * Processa o pipeline completo de gamificação para um perfil.
 * Calcula score → cumplicidade → badge → salva → calcula dissonância.
 * @param {string} perfilId O UUID do perfil.
 * @param {Array<Object>} userAnswers Os pesos dos sliders com ideology.
 * @return {Object} {score, complicityIndex, badge, dissonance} ou null.
 */
function processTestResults(perfilId, userAnswers) {
  try {
    const score = calculateBiasScore(userAnswers);
    const complicityIndex = calculateComplicityIndex(userAnswers);
    const badge = unlockBadge(score, complicityIndex);

    // Salva pontos na tabela Pontos (Módulo 4)
    savePoints(perfilId, score, badge);

    // Calcula dissonância conectando Módulo 3 ao Módulo 4
    const dissonance = processDissonance(perfilId, userAnswers);

    logEvent('Teste processado para ' + perfilId + ': ' + badge +
      ' (viés=' + score + ', cumplicidade=' + complicityIndex.toFixed(2) + ')', 'Gamification');

    return {
      score:           score,
      complicityIndex: complicityIndex,
      badge:           badge,
      dissonance:      dissonance
    };
  } catch (e) {
    logError('Erro ao processar teste: ' + e.message, 'Gamification');
    return null;
  }
}

