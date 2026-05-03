/**
 * @file Dissonance.gs
 * @description Algoritmo de cálculo de dissonância ideológica.
 *              Identifica contradições entre a posição ideológica teórica
 *              (Valor A: média ponderada das 105 respostas) e a análise prática
 *              (Valor B: pesos atribuídos aos fatos do Banco Master).
 * @module Módulo3_CRUD_Dissonancia
 * @version 2.0.0
 * @date 2026-03-15
 */

/**
 * Calcula a média ponderada das respostas do diagnóstico psicométrico (Valor A).
 * As respostas são agrupadas por eixo temático para análise granular.
 * @param {Object} answers O objeto {titulo_questao: valor_numerico, ...}.
 * @return {number} A média ponderada global das respostas (escala 1–10).
 */
function calculateWeightedAverage(answers) {
  let total = 0;
  let count = 0;
  for (const key in answers) {
    if (answers.hasOwnProperty(key)) {
      const val = Number(answers[key]);
      if (!isNaN(val)) {
        total += val;
        count++;
      }
    }
  }
  return count > 0 ? total / count : 0;
}

/**
 * Calcula a média ponderada por eixo temático.
 * Permite análise granular da posição ideológica em cada dimensão.
 * @param {Object} answers O objeto de respostas.
 * @param {Array<Object>} questions A lista de questões com propriedade 'axis'.
 * @return {Object} Médias por eixo: {1: média, 2: média, ...}.
 */
function calculateAxisAverages(answers, questions) {
  const axisTotals = {};
  const axisCounts = {};

  questions.forEach(function(q) {
    const val = Number(answers[q.title]);
    if (!isNaN(val)) {
      axisTotals[q.axis] = (axisTotals[q.axis] || 0) + val;
      axisCounts[q.axis] = (axisCounts[q.axis] || 0) + 1;
    }
  });

  const result = {};
  for (const axis in axisTotals) {
    result[axis] = axisTotals[axis] / axisCounts[axis];
  }
  return result;
}

/**
 * Identifica contradições lógicas entre posição ideológica teórica e análise prática.
 *
 * Fórmula de Dissonância Ideológica:
 *   coeficiente = abs(Valor_A − Valor_B)
 *
 * Onde:
 *   Valor A = média ponderada das respostas do formulário de 105 questões
 *             (indicando posição no espectro regulação vs. desregulamentação)
 *   Valor B = diferença normalizada entre pesos atribuídos a fatos esquerda/direita
 *             (indicando condescendência seletiva na análise das evidências)
 *
 * Valores elevados indicam miopia política ou desonestidade intelectual.
 *
 * @param {number} theoreticalValue Valor A: posição ideológica teórica (0–10).
 * @param {number} practicalBias Valor B: viés prático no julgamento de fatos (normalizado 0–10).
 * @return {Object} {coefficient, severity, description}.
 */
function calculateIdeologicalDissonance(theoreticalValue, practicalBias) {
  const coefficient = Math.abs(theoreticalValue - practicalBias);

  let severity, description;
  if (coefficient < 2) {
    severity = 'BAIXA';
    description = 'Alta coerência entre convicções teóricas e análise prática.';
  } else if (coefficient < 4) {
    severity = 'MODERADA';
    description = 'Dissonância moderada: possível viés inconsciente.';
  } else if (coefficient < 6) {
    severity = 'ELEVADA';
    description = 'Dissonância significativa: indícios de parcialidade seletiva.';
  } else {
    severity = 'CRÍTICA';
    description = 'Contradição fundamental entre posição teórica e análise prática dos fatos.';
  }

  return {
    coefficient: coefficient,
    severity:    severity,
    description: description
  };
}

/**
 * Processa o pipeline completo de dissonância para um perfil.
 * Conecta o Módulo 2 (diagnóstico) ao Módulo 4 (gamificação/fatos).
 * @param {string} perfilId O UUID do perfil.
 * @param {Array<Object>} factAnswers Os pesos atribuídos (sliders) com ideology.
 * @return {Object} O resultado da dissonância calculada.
 */
function processDissonance(perfilId, factAnswers) {
  const profile = readProfile(perfilId);
  if (!profile) {
    logError('Perfil não encontrado: ' + perfilId, 'Dissonance');
    return null;
  }

  // Valor A: posição ideológica teórica
  const theoreticalValue = calculateWeightedAverage(profile.answers);

  // Valor B: normaliza o bias score para escala 0–10
  const biasScore = calculateBiasScore(factAnswers);
  const maxPossibleBias = LIMITS.MAX_FACTS_PER_TEST * LIMITS.SCALE_MAX;
  const normalizedBias = (biasScore / maxPossibleBias) * LIMITS.SCALE_MAX;

  const result = calculateIdeologicalDissonance(theoreticalValue, normalizedBias);

  // Persiste o resultado
  saveDissonanceScore(perfilId, result.coefficient, result.severity);

  return result;
}

/**
 * Salva o coeficiente de dissonância na aba Dissonancia.
 * @param {string} perfilId O UUID do perfil.
 * @param {number} score O coeficiente de dissonância calculado.
 * @param {string} severity A classificação de severidade.
 */
function saveDissonanceScore(perfilId, score, severity) {
  getSheet(SHEET_NAMES.DISSONANCIA).appendRow([perfilId, score, severity, new Date()]);
  logEvent('Dissonância calculada para ' + perfilId + ': ' + severity, 'Dissonance');
}
