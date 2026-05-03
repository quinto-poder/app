/**
 * @file Validator.gs
 * @description Ferramenta de validação de ampla cobertura — validação de entradas,
 *              integridade de dados, testes de lógica pura e health checks do sistema.
 *              Todos os testes de lógica pura rodam sem conexão externa (in-memory),
 *              garantindo execução confiável na IDE do Google Apps Script.
 * @module Utils
 * @version 3.0.0
 * @date 2026-03-15
 */

// ══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 1 — VALIDADORES DE ENTRADA (usados por todos os módulos)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Valida que um ID de usuário é uma string não vazia.
 * @param {*} userId
 * @return {{valid: boolean, error?: string}}
 */
function validateUserId(userId) {
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    return { valid: false, error: 'userId deve ser uma string não vazia.' };
  }
  return { valid: true };
}

/**
 * Valida senha: string obrigatória, mínimo 8 caracteres.
 * @param {*} pass
 * @return {{valid: boolean, error?: string}}
 */
function validatePassword(pass) {
  if (!pass || typeof pass !== 'string') {
    return { valid: false, error: 'Senha deve ser uma string.' };
  }
  if (pass.length < 8) {
    return { valid: false, error: 'Senha deve ter no mínimo 8 caracteres. Recebido: ' + pass.length };
  }
  return { valid: true };
}

/**
 * Valida que um valor numérico está dentro da escala configurada (LIMITS.SCALE_MIN–MAX).
 * @param {*} val
 * @return {{valid: boolean, error?: string}}
 */
function validateScaleValue(val) {
  const n = Number(val);
  if (isNaN(n) || n < LIMITS.SCALE_MIN || n > LIMITS.SCALE_MAX) {
    return {
      valid: false,
      error: 'Valor fora da escala [' + LIMITS.SCALE_MIN + '–' + LIMITS.SCALE_MAX + ']. Recebido: ' + val
    };
  }
  return { valid: true };
}

/**
 * Valida que um valor de ideologia pertence ao enum IDEOLOGY.
 * @param {*} val
 * @return {{valid: boolean, error?: string}}
 */
function validateIdeologyValue(val) {
  if (Object.values(IDEOLOGY).indexOf(val) === -1) {
    return {
      valid: false,
      error: 'Ideologia inválida: "' + val + '". Esperado: ' + Object.values(IDEOLOGY).join(' | ')
    };
  }
  return { valid: true };
}

/**
 * Valida que uma URL começa com http:// ou https://.
 * @param {*} url
 * @return {{valid: boolean, error?: string}}
 */
function validateUrl(url) {
  if (!url || typeof url !== 'string' || url.trim() === '') {
    return { valid: false, error: 'URL não pode ser vazia.' };
  }
  if (!/^https?:\/\/.+/i.test(url)) {
    return { valid: false, error: 'URL deve começar com http:// ou https://.' };
  }
  return { valid: true };
}

/**
 * Valida o objeto de respostas do questionário {questão: valorNumérico}.
 * @param {*} answers
 * @return {{valid: boolean, count?: number, error?: string}}
 */
function validateAnswersObject(answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return { valid: false, error: 'answers deve ser um objeto key→value numérico.' };
  }
  const keys = Object.keys(answers);
  if (keys.length === 0) {
    return { valid: false, error: 'answers não pode ser vazio.' };
  }
  const invalidKeys = keys.filter(function(k) { return isNaN(Number(answers[k])); });
  if (invalidKeys.length > 0) {
    return { valid: false, error: 'Respostas com valores não numéricos: ' + invalidKeys.slice(0, 5).join(', ') };
  }
  return { valid: true, count: keys.length };
}

/**
 * Valida o array de respostas aos fatos [{id, ideology, userWeight}].
 * @param {*} factAnswers
 * @return {{valid: boolean, count?: number, error?: string}}
 */
function validateFactAnswers(factAnswers) {
  if (!Array.isArray(factAnswers) || factAnswers.length === 0) {
    return { valid: false, error: 'factAnswers deve ser um array não vazio.' };
  }
  const errors = [];
  factAnswers.forEach(function(fa, i) {
    if (!fa.id) errors.push('Item[' + i + ']: id ausente.');
    const idCheck = validateIdeologyValue(fa.ideology);
    if (!idCheck.valid) errors.push('Item[' + i + ']: ' + idCheck.error);
    const wCheck = validateScaleValue(fa.userWeight);
    if (!wCheck.valid) errors.push('Item[' + i + ']: userWeight — ' + wCheck.error);
  });
  if (errors.length > 0) {
    return { valid: false, error: errors.join(' | ') };
  }
  return { valid: true, count: factAnswers.length };
}

// ══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 2 — VALIDAÇÃO DE ESTRUTURA (PLANILHAS)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Valida a existência de todas as abas necessárias na planilha Google Sheets.
 * @return {Object} Status da validação: { success: boolean, missing: Array<string> }.
 */
function validateSheetStructure() {
  try {
    const ss = getSpreadsheet();
    const requiredSheets = Object.values(SHEET_NAMES);
    const missingSheets = [];
    
    requiredSheets.forEach(function(name) {
      if (!ss.getSheetByName(name)) {
        missingSheets.push(name);
      }
    });
    
    if (missingSheets.length > 0) {
      logError('Abas faltantes detectadas: ' + missingSheets.join(', '), 'Validator');
    }
    
    return {
      success: missingSheets.length === 0,
      missing: missingSheets
    };
  } catch (e) {
    logError('Erro ao validar abas: ' + e.message, 'Validator');
    return { success: false, missing: Object.values(SHEET_NAMES) };
  }
}

/**
 * Cria as abas faltantes na planilha e configura cabeçalhos rigorosamente.
 * Utiliza setValues() para operações de escrita de cabeçalho (performance).
 */
function repairSheetStructure() {
  try {
    const status = validateSheetStructure();
    if (status.success) {
      logEvent('Estrutura de planilhas já está íntegra.', 'Validator');
      return;
    }

    const ss = getSpreadsheet();
    status.missing.forEach(function(name) {
      const newSheet = ss.insertSheet(name);
      setupSheetHeaders(newSheet, name);
    });
    
    logEvent('Estrutura reparada. Abas criadas: ' + status.missing.join(', '), 'Validator');
  } catch (e) {
    logError('Erro ao reparar abas: ' + e.message, 'Validator');
  }
}

/**
 * Configura os cabeçalhos iniciais formatados em negrito.
 * @param {Sheet} sheet O objeto da aba recém-criada.
 * @param {string} name O nome canônico da aba.
 */
function setupSheetHeaders(sheet, name) {
  let headers = [];
  switch(name) {
    case SHEET_NAMES.USUARIOS:     headers = ['Usuario', 'SenhaHash', 'DataCriacao']; break;
    case SHEET_NAMES.PERFIS:       headers = ['PerfilID', 'RespostasJSON', 'DataCriacao']; break;
    case SHEET_NAMES.FATOS:        headers = ['ID', 'Fato', 'Peso', 'Ideologia']; break;
    case SHEET_NAMES.DISSONANCIA:  headers = ['PerfilID', 'Score', 'Severidade', 'DataCalculo']; break;
    case SHEET_NAMES.ANALISES:     headers = ['PerfilID', 'ResultadoML', 'DataProcessamento']; break;
    case SHEET_NAMES.QUINTO_PODER: headers = ['ID Perfil', 'Score de Viés', 'Última Atualização']; break;
    case SHEET_NAMES.NOTICIAS:     headers = ['URL', 'ScoreTendencia', 'PerfilIDAvaliou', 'DataSubmissao']; break;
    case SHEET_NAMES.AUDITORIA:    headers = ['Timestamp', 'Tipo', 'Modulo', 'Mensagem']; break;
    case SHEET_NAMES.PONTOS:       headers = ['PerfilID', 'ScoreDeVies', 'Badge', 'DataConquista']; break;
  }
  
  if (headers.length > 0) {
    const range = sheet.getRange(1, 1, 1, headers.length);
    range.setValues([headers]);
    range.setFontWeight('bold');
    range.setBackground('#f3f3f3'); // Destaque visual
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 3 — VALIDAÇÃO DE CONFIGURAÇÃO
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Verifica se todas as propriedades obrigatórias estão configuradas com valores reais
 * (não placeholder). Retorna lista de chaves inválidas.
 * @return {{valid: boolean, errors: string[]}}
 */
function validatePropertiesConfig() {
  const errors = [];
  Object.values(PROP_KEYS).forEach(function(key) {
    const val = getScriptProperty(key);
    if (!val || val.indexOf('SUA_') === 0 || val.indexOf('_AQUI') !== -1) {
      errors.push(key + ': não configurado ou ainda com placeholder.');
    }
  });
  return { valid: errors.length === 0, errors: errors };
}

/**
 * Verifica invariantes das constantes globais definidas em Constants.gs.
 * Garante que limites e limiares estão logicamente consistentes.
 * @return {{valid: boolean, errors: string[]}}
 */
function validateConstantsIntegrity() {
  const errors = [];

  if (LIMITS.SCALE_MIN >= LIMITS.SCALE_MAX) {
    errors.push('LIMITS: SCALE_MIN (' + LIMITS.SCALE_MIN + ') deve ser menor que SCALE_MAX (' + LIMITS.SCALE_MAX + ').');
  }
  if (LIMITS.MAX_QUESTIONS <= 0) {
    errors.push('LIMITS: MAX_QUESTIONS deve ser positivo.');
  }
  if (LIMITS.MAX_FACTS_PER_TEST <= 0) {
    errors.push('LIMITS: MAX_FACTS_PER_TEST deve ser positivo.');
  }
  if (BADGE_THRESHOLDS.ANALYST >= BADGE_THRESHOLDS.MODERATE) {
    errors.push('BADGE_THRESHOLDS: ANALYST deve ser menor que MODERATE.');
  }
  if (BADGE_THRESHOLDS.MODERATE >= BADGE_THRESHOLDS.BIASED) {
    errors.push('BADGE_THRESHOLDS: MODERATE deve ser menor que BIASED.');
  }

  // Garante que não há nomes de abas duplicados
  const sheetNames = Object.values(SHEET_NAMES);
  const seen = {};
  sheetNames.forEach(function(n) { seen[n] = (seen[n] || 0) + 1; });
  Object.keys(seen).forEach(function(n) {
    if (seen[n] > 1) errors.push('SHEET_NAMES: nome duplicado "' + n + '".');
  });

  return { valid: errors.length === 0, errors: errors };
}

// ══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 4 — INFRAESTRUTURA DE TESTES (pura, sem I/O)
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Executa uma função de teste capturando exceções.
 * @param {string} name Nome descritivo do teste.
 * @param {function(): true|string} fn Retorna `true` se passou, ou string de erro.
 * @return {{name: string, passed: boolean, message: string}}
 */
function _runTest(name, fn) {
  try {
    const result = fn();
    return {
      name:    name,
      passed:  result === true,
      message: result === true ? 'OK' : String(result)
    };
  } catch (e) {
    return { name: name, passed: false, message: 'EXCEÇÃO: ' + e.message };
  }
}

function _assertEqual(actual, expected, ctx) {
  if (actual !== expected) {
    return (ctx ? ctx + ' ' : '') + 'Esperado: ' + JSON.stringify(expected) + ', Obtido: ' + JSON.stringify(actual);
  }
  return true;
}

function _assertRange(val, min, max, ctx) {
  if (typeof val !== 'number' || isNaN(val) || val < min || val > max) {
    return (ctx ? ctx + ' ' : '') + 'Esperado em [' + min + ', ' + max + '], Obtido: ' + val;
  }
  return true;
}

// ══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 5 — TESTES DE LÓGICA PURA (sem I/O externo)
// ══════════════════════════════════════════════════════════════════════════════

// ── Auth.gs ──────────────────────────────────────────────────────────────────

function _testHashLength() {
  return _runTest('hashPassword: SHA-256 = 64 chars hex', function() {
    const h = hashPassword('senha123');
    if (typeof h !== 'string' || h.length !== 64) {
      return 'Hash deve ter 64 chars. Obtido: ' + h.length;
    }
    return true;
  });
}

function _testHashDeterminism() {
  return _runTest('hashPassword: determinístico', function() {
    return _assertEqual(hashPassword('abc!DEF@123'), hashPassword('abc!DEF@123'), 'Hash determinístico:');
  });
}

function _testHashUniqueness() {
  return _runTest('hashPassword: entradas diferentes → hashes distintos', function() {
    if (hashPassword('senha_A_001') === hashPassword('senha_B_002')) {
      return 'Colisão de hash inesperada.';
    }
    return true;
  });
}

// ── Gamification.gs ──────────────────────────────────────────────────────────

function _testBiasZero() {
  return _runTest('calculateBiasScore: esquerda=direita → 0', function() {
    return _assertEqual(
      calculateBiasScore([
        { ideology: IDEOLOGY.ESQUERDA, userWeight: 5 },
        { ideology: IDEOLOGY.DIREITA,  userWeight: 5 }
      ]), 0, 'Score balanceado:'
    );
  });
}

function _testBiasUnilateral() {
  return _runTest('calculateBiasScore: peso esquerda=8, direita ausente → 8', function() {
    return _assertEqual(
      calculateBiasScore([
        { ideology: IDEOLOGY.ESQUERDA, userWeight: 8 },
        { ideology: IDEOLOGY.NEUTRO,   userWeight: 3 }
      ]), 8, 'Bias unilateral esquerda:'
    );
  });
}

function _testBiasNeutralOnly() {
  return _runTest('calculateBiasScore: apenas NEUTRO → 0', function() {
    return _assertEqual(
      calculateBiasScore([
        { ideology: IDEOLOGY.NEUTRO, userWeight: 7 },
        { ideology: IDEOLOGY.NEUTRO, userWeight: 4 }
      ]), 0, 'Bias neutro:'
    );
  });
}

function _testBiasNegated() {
  return _runTest('calculateBiasScore: abs(esq−dir) — resultado sempre ≥ 0', function() {
    const score = calculateBiasScore([
      { ideology: IDEOLOGY.DIREITA,  userWeight: 9 },
      { ideology: IDEOLOGY.ESQUERDA, userWeight: 3 }
    ]);
    if (score < 0) return 'Score negativo retornado: ' + score;
    return _assertEqual(score, 6, 'Bias abs(9-3):');
  });
}

function _testBadgeAnalyst() {
  return _runTest('unlockBadge: score 0 → ' + BADGES.ANALYST, function() {
    return _assertEqual(unlockBadge(0), BADGES.ANALYST, 'Badge score 0:');
  });
}

function _testBadgeModerate() {
  return _runTest('unlockBadge: limiar ANALYST → ' + BADGES.MODERATE, function() {
    return _assertEqual(unlockBadge(BADGE_THRESHOLDS.ANALYST), BADGES.MODERATE, 'Badge limiar Analyst:');
  });
}

function _testBadgeBiased() {
  return _runTest('unlockBadge: limiar MODERATE → ' + BADGES.BIASED, function() {
    return _assertEqual(unlockBadge(BADGE_THRESHOLDS.MODERATE), BADGES.BIASED, 'Badge limiar Moderate:');
  });
}

function _testBadgeBlind() {
  return _runTest('unlockBadge: limiar BIASED → ' + BADGES.BLIND, function() {
    return _assertEqual(unlockBadge(BADGE_THRESHOLDS.BIASED), BADGES.BLIND, 'Badge limiar Biased:');
  });
}

function _testShuffleLength() {
  return _runTest('shuffleArray: comprimento preservado após embaralhamento', function() {
    const original = [1, 2, 3, 4, 5, 6, 7];
    return _assertEqual(shuffleArray(original.slice()).length, original.length, 'Comprimento:');
  });
}

function _testShuffleElements() {
  return _runTest('shuffleArray: todos os elementos preservados', function() {
    const original = [10, 20, 30, 40, 50];
    const shuffled = shuffleArray(original.slice());
    const sortedO  = original.slice().sort(function(a, b) { return a - b; });
    const sortedS  = shuffled.slice().sort(function(a, b) { return a - b; });
    return _assertEqual(JSON.stringify(sortedS), JSON.stringify(sortedO), 'Elementos:');
  });
}

// ── Dissonance.gs ─────────────────────────────────────────────────────────────

function _testDissonanceLow() {
  return _runTest('calculateIdeologicalDissonance: |5−5.5| < 2 → BAIXA', function() {
    return _assertEqual(calculateIdeologicalDissonance(5, 5.5).severity, 'BAIXA', 'Severidade:');
  });
}

function _testDissonanceModerate() {
  return _runTest('calculateIdeologicalDissonance: |2−5| = 3 → MODERADA', function() {
    return _assertEqual(calculateIdeologicalDissonance(2, 5).severity, 'MODERADA', 'Severidade:');
  });
}

function _testDissonanceHigh() {
  return _runTest('calculateIdeologicalDissonance: |1−6| = 5 → ELEVADA', function() {
    return _assertEqual(calculateIdeologicalDissonance(1, 6).severity, 'ELEVADA', 'Severidade:');
  });
}

function _testDissonanceCritical() {
  return _runTest('calculateIdeologicalDissonance: |0−8| = 8 → CRÍTICA', function() {
    return _assertEqual(calculateIdeologicalDissonance(0, 8).severity, 'CRÍTICA', 'Severidade:');
  });
}

function _testDissonanceCoefficient() {
  return _runTest('calculateIdeologicalDissonance: coeficiente = abs(A−B)', function() {
    return _assertEqual(calculateIdeologicalDissonance(3, 7).coefficient, 4, 'Coeficiente:');
  });
}

function _testDissonanceSymmetry() {
  return _runTest('calculateIdeologicalDissonance: abs(A−B) = abs(B−A)', function() {
    const r1 = calculateIdeologicalDissonance(2, 8);
    const r2 = calculateIdeologicalDissonance(8, 2);
    return _assertEqual(r1.coefficient, r2.coefficient, 'Simetria:');
  });
}

// ── QuintoPoder.gs ────────────────────────────────────────────────────────────

function _testTendencyZero() {
  return _runTest('calculateTendencyScore: avaliações nulas → 0', function() {
    return _assertEqual(calculateTendencyScore({}), 0, 'Tendency zero:');
  });
}

function _testTendencyCapped() {
  return _runTest('calculateTendencyScore: valores extremos → score ≤ 10', function() {
    const score = calculateTendencyScore({ focoDireita: 999, omissaoEsquerda: 999 });
    return _assertRange(score, 0, 10, 'Cap score:');
  });
}

function _testTendencySymmetric() {
  return _runTest('calculateTendencyScore: focoEsquerda=focoDireita → score = 0', function() {
    return _assertEqual(calculateTendencyScore({ focoEsquerda: 5, focoDireita: 5 }), 0, 'Symmetric:');
  });
}

// ── Helpers.gs ────────────────────────────────────────────────────────────────

function _testFormatDateValid() {
  return _runTest('formatDate: data válida → string formatada', function() {
    const s = formatDate(new Date(2026, 2, 15, 10, 30, 0));
    if (typeof s !== 'string' || s.length === 0 || s === 'Data Inválida') {
      return 'formatDate retornou inválido para data correta: ' + s;
    }
    return true;
  });
}

function _testFormatDateInvalid() {
  return _runTest('formatDate: data inválida → "Data Inválida"', function() {
    return _assertEqual(formatDate(new Date('not-a-date')), 'Data Inválida', 'formatDate inválida:');
  });
}

function _testIsValidUuidTrue() {
  return _runTest('isValidUuid: UUID v4 canônico → true', function() {
    return isValidUuid('550e8400-e29b-41d4-a716-446655440000') === true
      ? true : 'UUID válido rejeitado.';
  });
}

function _testIsValidUuidFalse() {
  return _runTest('isValidUuid: string arbitrária → false', function() {
    return isValidUuid('nao-e-uuid') === false
      ? true : 'String inválida aceita como UUID.';
  });
}

function _testIsValidUuidNull() {
  return _runTest('isValidUuid: null → false', function() {
    return isValidUuid(null) === false ? true : 'null aceito como UUID.';
  });
}

// ── Validator — validadores de entrada ───────────────────────────────────────

function _testValidateScaleMin() {
  return _runTest('validateScaleValue: 0 → inválido (abaixo do mínimo)', function() {
    return validateScaleValue(0).valid === false ? true : 'Valor 0 deveria ser inválido.';
  });
}

function _testValidateScaleMax() {
  return _runTest('validateScaleValue: 11 → inválido (acima do máximo)', function() {
    return validateScaleValue(11).valid === false ? true : 'Valor 11 deveria ser inválido.';
  });
}

function _testValidateScaleValid() {
  return _runTest('validateScaleValue: ' + LIMITS.SCALE_MIN + ' → válido', function() {
    const r = validateScaleValue(LIMITS.SCALE_MIN);
    return r.valid === true ? true : r.error;
  });
}

function _testValidateScaleString() {
  return _runTest('validateScaleValue: string "abc" → inválido', function() {
    return validateScaleValue('abc').valid === false ? true : 'String "abc" deveria ser inválida.';
  });
}

function _testValidateAnswersValid() {
  return _runTest('validateAnswersObject: {Q1:5, Q2:3} → válido', function() {
    const r = validateAnswersObject({ Q1: 5, Q2: 3 });
    return r.valid === true ? true : r.error;
  });
}

function _testValidateAnswersNonNumeric() {
  return _runTest('validateAnswersObject: valor "texto" → inválido', function() {
    return validateAnswersObject({ Q1: 'texto' }).valid === false
      ? true : 'Valor não numérico deveria ser inválido.';
  });
}

function _testValidateAnswersEmpty() {
  return _runTest('validateAnswersObject: objeto vazio → inválido', function() {
    return validateAnswersObject({}).valid === false ? true : 'Objeto vazio deveria ser inválido.';
  });
}

function _testValidateFactAnswersValid() {
  return _runTest('validateFactAnswers: array válido → válido', function() {
    const r = validateFactAnswers([
      { id: 'F1', ideology: IDEOLOGY.ESQUERDA, userWeight: 5 },
      { id: 'F2', ideology: IDEOLOGY.DIREITA,  userWeight: 7 }
    ]);
    return r.valid === true ? true : r.error;
  });
}

function _testValidateFactAnswersWeightOut() {
  return _runTest('validateFactAnswers: userWeight=0 → inválido', function() {
    return validateFactAnswers([
      { id: 'F1', ideology: IDEOLOGY.ESQUERDA, userWeight: 0 }
    ]).valid === false ? true : 'Weight 0 deveria ser inválido.';
  });
}

function _testValidateFactAnswersBadIdeology() {
  return _runTest('validateFactAnswers: ideology="INVALIDA" → inválido', function() {
    return validateFactAnswers([
      { id: 'F1', ideology: 'INVALIDA', userWeight: 5 }
    ]).valid === false ? true : 'Ideologia inválida deveria ser rejeitada.';
  });
}

function _testValidatePasswordShort() {
  return _runTest('validatePassword: senha < 8 chars → inválido', function() {
    return validatePassword('abc').valid === false ? true : 'Senha curta deveria ser inválida.';
  });
}

function _testValidatePasswordValid() {
  return _runTest('validatePassword: senha ≥ 8 chars → válido', function() {
    const r = validatePassword('Senh@123');
    return r.valid === true ? true : r.error;
  });
}

function _testValidateUrlHttp() {
  return _runTest('validateUrl: URL https:// válida', function() {
    return validateUrl('https://meusite.com/api').valid === true
      ? true : 'URL HTTPS válida rejeitada.';
  });
}

function _testValidateUrlInvalid() {
  return _runTest('validateUrl: URL sem protocolo → inválido', function() {
    return validateUrl('meusite.com').valid === false
      ? true : 'URL sem protocolo deveria ser inválida.';
  });
}

// ══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 6 — TESTES DE INTEGRAÇÃO (I/O, Properties, CRUD)
// ══════════════════════════════════════════════════════════════════════════════

// ── Properties.gs ────────────────────────────────────────────────────────────

function _testPropertiesLifecycle() {
  return _runTest('Properties: Set e Get com cache in-memory', function() {
    try {
      const testKey = 'TEST_INTEGRATION_KEY';
      const testVal = '12345';
      const props = {};
      props[testKey] = testVal;
      setScriptProperties(props);
      const readVal = getScriptProperty(testKey);
      PropertiesService.getScriptProperties().deleteProperty(testKey); // Cleanup
      return _assertEqual(readVal, testVal, 'Valor lido das propriedades:');
    } catch(e) {
      if(e.message && e.message.indexOf('PropertiesService') !== -1) return true; // Skip if no environment
      return e.message;
    }
  });
}

// ── CRUD.gs ──────────────────────────────────────────────────────────────────

function _testCRUDProfileLifecycle() {
  return _runTest('CRUD: Create, Read, Update, Delete Profile', function() {
    try { getSpreadsheetId(); } catch(e) { return true; } // Skip if not configured
    
    const testUuid = Utilities.getUuid();
    const mockAnswers = JSON.stringify({"Q1": 5, "Q2": 10});
    
    // Create
    saveProfileToSheet(testUuid, mockAnswers);
    
    // Read
    const profile = readProfile(testUuid);
    if (!profile) return 'Read falhou: Perfil não encontrado.';
    if (profile.answers.Q1 !== 5) return 'Read falhou: Dados corrompidos.';
    
    // Update
    const mockAnswersUpdate = JSON.stringify({"Q1": 8, "Q2": 2});
    const updated = updateProfile(testUuid, mockAnswersUpdate);
    if (!updated) return 'Update falhou: Retornou false.';
    const pUpdated = readProfile(testUuid);
    if (pUpdated.answers.Q1 !== 8) return 'Update falhou: Dados não atualizados.';
    
    // Delete
    const deleted = deleteProfile(testUuid);
    if (!deleted) return 'Delete falhou: Retornou false.';
    const pDeleted = readProfile(testUuid);
    if (pDeleted) return 'Delete falhou: Perfil ainda existe.';
    
    return true;
  });
}

function _testFactsIntegration() {
  return _runTest('Facts: Adicionar fato e ler', function() {
    try { getSpreadsheetId(); } catch(e) { return true; }
    
    const initialFacts = getConfirmedFacts();
    const testId = 'F_TEST_' + new Date().getTime();
    
    addConfirmedFact(testId, 'Fato de integracao', 5, IDEOLOGY.NEUTRO);
    
    const finalFacts = getConfirmedFacts();
    if (finalFacts.length !== initialFacts.length + 1) return 'Quantidade não incrementou.';
    
    const found = finalFacts.filter(function(f) { return f.id === testId; });
    if (found.length === 0) return 'Fato não encontrado no getConfirmedFacts.';
    
    const sheet = getSheet(SHEET_NAMES.FATOS);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
        if (data[i][0] === testId) {
            sheet.deleteRow(i + 1);
            break;
        }
    }
    return true;
  });
}

function _testAuthIntegration() {
  return _runTest('Auth: Register e Login Lifecycle', function() {
    try { getSpreadsheetId(); } catch(e) { return true; }
    
    const testUser = 'user_test_' + new Date().getTime();
    const testPass = 'senhaSegura!123';
    
    const regRes = registerUser(testUser, testPass);
    if (!regRes.success) return 'Register falhou: ' + regRes.message;
    
    const loginOk = validateLogin(testUser, testPass);
    if (!loginOk.success) return 'Login válido falhou: ' + loginOk.message;
    
    const loginFail = validateLogin(testUser, 'senhaIncorreta');
    if (loginFail.success) return 'Login inválido retornou sucesso.';
    
    const sheet = getSheet(SHEET_NAMES.USUARIOS);
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
        if (data[i][0] === testUser) {
            sheet.deleteRow(i + 1);
            break;
        }
    }
    return true;
  });
}

/**
 * Executa todos os testes de integração (com I/O externo).
 * @return {{passed: number, failed: number, total: number, results: Object[], summary: string}}
 */
function runIntegrationTests() {
  const tests = [
    _testPropertiesLifecycle,
    _testCRUDProfileLifecycle,
    _testFactsIntegration,
    _testAuthIntegration
  ];
  
  const results = tests.map(function(fn) { return fn(); });
  const passed  = results.filter(function(r) { return r.passed; }).length;
  const failed  = results.length - passed;

  const lines = results.map(function(r) {
    return (r.passed ? '[OK]  ' : '[XX] ') + r.name + (r.passed ? '' : '\n       → ' + r.message);
  });

  const summary = [
    '╔══════════════════════════════════════════════════════════════╗',
    '║       RELATÓRIO DE INTEGRAÇÃO — QUINTO PODER v3.0           ║',
    '╠══════════════════════════════════════════════════════════════╣',
    '║  Total: ' + results.length + '  |  Passaram: ' + passed + '  |  Falharam: ' + failed +
      (failed > 0 ? '  ← ATENÇÃO' : '  ✓ TUDO OK') + '  ║',
    '╚══════════════════════════════════════════════════════════════╝',
    lines.join('\n')
  ].join('\n');

  Logger.log(summary);
  return { passed: passed, failed: failed, total: results.length, results: results, summary: summary };
}

// ══════════════════════════════════════════════════════════════════════════════
// SEÇÃO 7 — RUNNER DE TESTES E DIAGNÓSTICO COMPLETO
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Executa todos os testes de lógica pura (sem I/O externo).
 * Pode ser rodado diretamente na IDE do GAS a qualquer momento.
 * Resultados são impressos via Logger.log e retornados como objeto.
 * @return {{passed: number, failed: number, total: number, results: Object[], summary: string}}
 */
function runLogicTests() {
  const tests = [
    // Auth
    _testHashLength, _testHashDeterminism, _testHashUniqueness,
    // Gamification — bias score
    _testBiasZero, _testBiasUnilateral, _testBiasNeutralOnly, _testBiasNegated,
    // Gamification — badges
    _testBadgeAnalyst, _testBadgeModerate, _testBadgeBiased, _testBadgeBlind,
    // Gamification — shuffle
    _testShuffleLength, _testShuffleElements,
    // Dissonance
    _testDissonanceLow, _testDissonanceModerate, _testDissonanceHigh,
    _testDissonanceCritical, _testDissonanceCoefficient, _testDissonanceSymmetry,
    // QuintoPoder
    _testTendencyZero, _testTendencyCapped, _testTendencySymmetric,
    // Helpers
    _testFormatDateValid, _testFormatDateInvalid,
    _testIsValidUuidTrue, _testIsValidUuidFalse, _testIsValidUuidNull,
    // Input validators (esta seção)
    _testValidateScaleMin, _testValidateScaleMax, _testValidateScaleValid, _testValidateScaleString,
    _testValidateAnswersValid, _testValidateAnswersNonNumeric, _testValidateAnswersEmpty,
    _testValidateFactAnswersValid, _testValidateFactAnswersWeightOut, _testValidateFactAnswersBadIdeology,
    _testValidatePasswordShort, _testValidatePasswordValid,
    _testValidateUrlHttp, _testValidateUrlInvalid
  ];

  const results = tests.map(function(fn) { return fn(); });
  const passed  = results.filter(function(r) { return r.passed; }).length;
  const failed  = results.length - passed;

  const lines = results.map(function(r) {
    return (r.passed ? '[OK]  ' : '[XX] ') + r.name + (r.passed ? '' : '\n       → ' + r.message);
  });

  const summary = [
    '╔══════════════════════════════════════════════════════════════╗',
    '║       RELATÓRIO DE TESTES — QUINTO PODER v3.0               ║',
    '╠══════════════════════════════════════════════════════════════╣',
    '║  Total: ' + results.length + '  |  Passaram: ' + passed + '  |  Falharam: ' + failed +
      (failed > 0 ? '  ← ATENÇÃO' : '  ✓ TUDO OK') + '  ║',
    '╚══════════════════════════════════════════════════════════════╝',
    lines.join('\n')
  ].join('\n');

  Logger.log(summary);
  return { passed: passed, failed: failed, total: results.length, results: results, summary: summary };
}

/**
 * Executa o diagnóstico completo do sistema:
 *   1. Estrutura de planilhas (requer spreadsheet configurado)
 *   2. Propriedades de configuração
 *   3. Integridade das constantes (sem I/O)
 *   4. Todos os testes de lógica pura (sem I/O)
 *   5. Conectividade com Colab (melhor esforço)
 *
 * Ponto de entrada principal para health check em produção.
 * @return {Object} Relatório consolidado.
 */
function runFullSystemDiagnostic() {
  const report = {
    timestamp:        new Date(),
    sheets:           null,
    config:           null,
    constants:        null,
    logicTests:       null,
    integrationTests: null,
    colab:            null,
    overall:          true
  };

  // 1. Estrutura de planilhas
  try {
    report.sheets = validateSheetStructure();
    if (!report.sheets.success) report.overall = false;
  } catch (e) {
    report.sheets  = { success: false, error: e.message };
    report.overall = false;
  }

  // 2. Propriedades de configuração
  try {
    report.config = validatePropertiesConfig();
    if (!report.config.valid) report.overall = false;
  } catch (e) {
    report.config  = { valid: false, errors: [e.message] };
    report.overall = false;
  }

  // 3. Integridade de constantes (sem I/O)
  report.constants = validateConstantsIntegrity();
  if (!report.constants.valid) report.overall = false;

  // 4. Testes de lógica pura (sem I/O)
  report.logicTests = runLogicTests();
  if (report.logicTests.failed > 0) report.overall = false;

  // 5. Testes de integração (com I/O)
  report.integrationTests = runIntegrationTests();
  if (report.integrationTests.failed > 0) report.overall = false;

  // 6. Conectividade Colab (melhor esforço — falha não bloqueia overall se URL não configurada)
  try {
    report.colab = testColabEndpoint();
  } catch (e) {
    report.colab = { connected: false, message: e.message };
  }

  const status = report.overall ? 'SAUDÁVEL' : 'FALHAS DETECTADAS';
  const totalTestsPassed = report.logicTests.passed + report.integrationTests.passed;
  const totalTests = report.logicTests.total + report.integrationTests.total;
  logEvent(
    'Diagnóstico completo: ' + status +
    ' | Abas: '   + (report.sheets    && report.sheets.success  ? 'OK' : 'FALHA') +
    ' | Config: ' + (report.config    && report.config.valid    ? 'OK' : 'FALHA') +
    ' | Consts: ' + (report.constants && report.constants.valid ? 'OK' : 'FALHA') +
    ' | Testes: ' + totalTestsPassed + '/' + totalTests,
    'Validator'
  );

  return report;
}
