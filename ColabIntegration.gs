/**
 * @file ColabIntegration.gs
 * @description Orquestração da comunicação com o Google Colab via UrlFetchApp.
 *              Implementa retry com backoff exponencial, validação de resposta
 *              e logging de auditoria para cada operação de ML.
 * @module Módulo5_Colab_ML
 * @see Ref 51: Using ngrok with Google Colab
 * @see Ref 52: Comprehensive guide to UrlFetchApp — Spreadsheet Dev
 * @see Ref 53: Class UrlFetchApp — Google for Developers
 * @version 2.0.0
 * @date 2026-03-15
 */

/**
 * Executa a análise preditiva de Machine Learning no Google Colab.
 * O endpoint Python (Flask/FastAPI) exposto via pyngrok processa vetores
 * psicométricos com K-Means e PCA (scikit-learn), cruzando inclinações
 * teóricas contra condescendência prática com as fraudes do Master.
 *
 * @param {string} perfilId O UUID do perfil do usuário.
 * @return {Object|null} O resultado da análise ou null em caso de falha.
 */
function executeColabAnalysis(perfilId) {
  const colabUrl = getColabUrl();
  const profileData = readProfile(perfilId);

  if (!profileData) {
    logError('Perfil não encontrado para análise ML: ' + perfilId, 'ColabIntegration');
    return null;
  }

  const factsData = getConfirmedFacts();

  // Estrutura do payload conforme documentado:
  // {perfil_data: ..., fatos_master: ...}
  const payload = {
    perfil_data:  profileData,
    fatos_master: factsData
  };

  const options = {
    method:             HTTP.METHOD_POST,
    contentType:        HTTP.CONTENT_JSON,
    payload:            JSON.stringify(payload),
    muteHttpExceptions: true,
    // Timeout para evitar exceder o limite de 6 min do GAS
    timeoutInSeconds:   60
  };

  // Retry com backoff exponencial
  let lastError = null;
  for (let attempt = 1; attempt <= HTTP.MAX_RETRIES; attempt++) {
    try {
      const response = UrlFetchApp.fetch(colabUrl + '/analyze', options);
      const responseCode = response.getResponseCode();

      if (responseCode === 200) {
        const result = JSON.parse(response.getContentText());

        // Valida que a resposta contém os campos esperados
        if (!result || typeof result !== 'object') {
          logError('Resposta do Colab inválida (não é objeto JSON).', 'ColabIntegration');
          return null;
        }

        saveMLResults(perfilId, result);
        logEvent('Análise ML concluída para ' + perfilId + ' (tentativa ' + attempt + ').', 'ColabIntegration');
        return result;
      }

      lastError = 'HTTP ' + responseCode + ': ' + response.getContentText().substring(0, 200);
      logError('Tentativa ' + attempt + ' falhou: ' + lastError, 'ColabIntegration');

    } catch (e) {
      lastError = e.message;
      logError('Tentativa ' + attempt + ' — exceção: ' + lastError, 'ColabIntegration');
    }

    // Backoff exponencial (2s, 4s, 8s...)
    if (attempt < HTTP.MAX_RETRIES) {
      Utilities.sleep(HTTP.RETRY_DELAY_MS * Math.pow(2, attempt - 1));
    }
  }

  logError('Todas as ' + HTTP.MAX_RETRIES + ' tentativas falharam para ' + perfilId + '. Último erro: ' + lastError, 'ColabIntegration');
  return null;
}

/**
 * Salva os resultados da análise de ML na aba Analises.
 * @param {string} perfilId O UUID do perfil do usuário.
 * @param {Object} result O resultado serializado da análise de ML.
 */
function saveMLResults(perfilId, result) {
  getSheet(SHEET_NAMES.ANALISES).appendRow([perfilId, JSON.stringify(result), new Date()]);
}

/**
 * Testa a conectividade com o endpoint do Colab.
 * Útil para verificação antes de deploy de produção.
 * @return {Object} {connected: boolean, responseCode: number, message: string}.
 */
function testColabEndpoint() {
  try {
    const url = getColabUrl();
    const response = UrlFetchApp.fetch(url + '/health', { muteHttpExceptions: true });
    const code = response.getResponseCode();
    return {
      connected:    code === 200,
      responseCode: code,
      message:      code === 200 ? 'Conexão OK.' : 'Endpoint respondeu com código ' + code
    };
  } catch (e) {
    return {
      connected:    false,
      responseCode: 0,
      message:      'Falha na conexão: ' + e.message
    };
  }
}
