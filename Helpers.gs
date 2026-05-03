/**
 * @file Helpers.gs
 * @description Funções utilitárias e de validação diversas.
 * @module Utils
 * @version 2.0.0
 * @date 2026-03-15
 */

/**
 * Retorna uma data formatada para exibição em interfaces de usuário.
 * @param {Date} date O objeto de data.
 * @return {string} A data formatada como 'DD/MM/AAAA HH:MM:SS'.
 */
function formatDate(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return 'Data Inválida';
  }
  return Utilities.formatDate(date, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm:ss');
}

/**
 * Retorna um identificador único seguro.
 * @return {string} O UUID gerado.
 */
function generateTransactionId() {
  return Utilities.getUuid();
}

/**
 * Registra um log de erro na aba Auditoria.
 * Utiliza getSheet() do CRUD.gs para aproveitar o cache da spreadsheet.
 * @param {string} message A mensagem de erro descritiva.
 * @param {string} module O módulo onde o erro ocorreu.
 */
function logError(message, module) {
  try {
    const sheet = getSheet(SHEET_NAMES.AUDITORIA);
    sheet.appendRow([new Date(), 'ERRO', module || 'Desconhecido', String(message)]);
    Logger.log('ERRO [' + module + ']: ' + message);
  } catch (e) {
    // Fallback silencioso se a aba não existir
    Logger.log('FALHA DE AUDITORIA: Não foi possível logar erro - ' + e.message);
  }
}

/**
 * Registra um log de evento (informativo) na aba Auditoria.
 * @param {string} message A mensagem do evento.
 * @param {string} module O módulo onde o evento ocorreu.
 */
function logEvent(message, module) {
  try {
    const sheet = getSheet(SHEET_NAMES.AUDITORIA);
    sheet.appendRow([new Date(), 'EVENTO', module || 'Desconhecido', String(message)]);
  } catch (e) {
    Logger.log('FALHA DE AUDITORIA: Não foi possível logar evento - ' + e.message);
  }
}

/**
 * Valida se uma string de entrada é um UUID formatado corretamente.
 * @param {string} str A string a ser testada.
 * @return {boolean} True se for um UUID válido.
 */
function isValidUuid(str) {
  if (!str || typeof str !== 'string') return false;
  const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return regex.test(str);
}
