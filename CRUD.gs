/**
 * @file CRUD.gs
 * @description Operações transacionais otimizadas (Create, Read, Update, Delete)
 *              para manipulação de dados no Google Sheets. Segue as melhores
 *              práticas de operações em lote: toda leitura usa getDataRange().getValues()
 *              e toda escrita usa setValues() em bloco, evitando alternância
 *              read/write dentro de loops (anti-pattern documentado na Ref 47).
 * @module Módulo3_CRUD_Dissonancia
 * @see Ref 47: Best Practices — Google Apps Script
 * @version 2.0.0
 * @date 2026-03-15
 */

/**
 * Cache in-memory do objeto Spreadsheet para evitar chamadas repetidas
 * a SpreadsheetApp.openById() dentro da mesma execução.
 * @private
 */
let _spreadsheetCache = null;

/**
 * Obtém o objeto Spreadsheet com cache in-memory.
 * @return {Spreadsheet} O objeto da planilha.
 */
function getSpreadsheet() {
  if (!_spreadsheetCache) {
    _spreadsheetCache = SpreadsheetApp.openById(getSpreadsheetId());
  }
  return _spreadsheetCache;
}

/**
 * Obtém uma aba específica da planilha por nome canônico.
 * @param {string} sheetName O nome da aba (usar SHEET_NAMES.*).
 * @return {Sheet} O objeto da aba.
 * @throws {Error} Se a aba não existir.
 */
function getSheet(sheetName) {
  const sheet = getSpreadsheet().getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Aba "' + sheetName + '" não encontrada na planilha.');
  }
  return sheet;
}

/**
 * Salva um perfil de usuário na aba Perfis (operação Create).
 * Utiliza appendRow para inserção atômica de uma linha.
 * @param {string} perfilId O UUID gerado por Utilities.getUuid().
 * @param {string} answersJson O JSON.stringify() das 105 respostas serializado.
 */
function saveProfileToSheet(perfilId, answersJson) {
  getSheet(SHEET_NAMES.PERFIS).appendRow([perfilId, answersJson, new Date()]);
  logEvent('Perfil salvo: ' + perfilId, 'CRUD');
}

/**
 * Lê todos os perfis da aba Perfis em lote (operação em bloco).
 * Carrega a integralidade do banco para a memória RAM local, excluindo cabeçalhos.
 * @return {Array<Array>} Matriz de dados: [PerfilID, RespostasJSON, DataCriacao].
 */
function readAllProfiles() {
  const data = getSheet(SHEET_NAMES.PERFIS).getDataRange().getValues();
  return data.slice(1); // Exclui cabeçalhos
}

/**
 * Busca um perfil específico pelo seu UUID (operação Read).
 * Otimização: realiza busca linear sobre dados já carregados em memória,
 * evitando chamada adicional à API do Google Sheets.
 * @param {string} perfilId O UUID do perfil.
 * @return {Object|null} O perfil {id, answers, timestamp} ou null se não existir.
 */
function readProfile(perfilId) {
  const data = getSheet(SHEET_NAMES.PERFIS).getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === perfilId) {
      return {
        id:        data[i][0],
        answers:   JSON.parse(data[i][1]),
        timestamp: data[i][2]
      };
    }
  }
  return null;
}

/**
 * Atualiza o JSON de respostas de um perfil existente (operação Update).
 * Localiza a linha pelo perfilId e reescreve em bloco via setValues().
 * @param {string} perfilId O UUID do perfil.
 * @param {string} newAnswersJson O novo JSON serializado das respostas.
 * @return {boolean} True se o perfil foi encontrado e atualizado.
 */
function updateProfile(perfilId, newAnswersJson) {
  const sheet = getSheet(SHEET_NAMES.PERFIS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === perfilId) {
      // Atualiza em bloco: coluna B (RespostasJSON) e C (timestamp)
      sheet.getRange(i + 1, 2, 1, 2).setValues([[newAnswersJson, new Date()]]);
      logEvent('Perfil atualizado: ' + perfilId, 'CRUD');
      return true;
    }
  }
  logError('Perfil não encontrado para atualização: ' + perfilId, 'CRUD');
  return false;
}

/**
 * Remove um perfil pelo seu UUID (operação Delete).
 * @param {string} perfilId O UUID do perfil.
 * @return {boolean} True se o perfil foi encontrado e removido.
 */
function deleteProfile(perfilId) {
  const sheet = getSheet(SHEET_NAMES.PERFIS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === perfilId) {
      sheet.deleteRow(i + 1);
      logEvent('Perfil removido: ' + perfilId, 'CRUD');
      return true;
    }
  }
  logError('Perfil não encontrado para remoção: ' + perfilId, 'CRUD');
  return false;
}

/**
 * Salva pontos e badge na aba Pontos (sistema de gamificação, Módulo 4).
 * @param {string} perfilId O UUID do perfil.
 * @param {number} score O score de viés calculado.
 * @param {string} badge O badge desbloqueado.
 */
function savePoints(perfilId, score, badge) {
  getSheet(SHEET_NAMES.PONTOS).appendRow([perfilId, score, badge, new Date()]);
  logEvent('Pontos salvos para ' + perfilId + ': ' + badge, 'CRUD');
}
