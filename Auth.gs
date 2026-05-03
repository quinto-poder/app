/**
 * @file Auth.gs
 * @description Autenticação de usuários com hashing SHA-256 e ponto de entrada
 *              do Web App (doGet). A função hashPassword() implementa rigorosamente
 *              o complemento de dois para bytes negativos e padding hexadecimal
 *              conforme documentado nas referências de criptografia do GAS.
 * @module Módulo1_Autenticacao
 * @see Ref 38: SHA-256 encryption in Google Apps Script — Stack Overflow
 * @see Ref 40: Padding de zeros à esquerda para evitar colisões — Google Groups
 * @version 2.0.0
 * @date 2026-03-15
 */

/**
 * Gera um hash SHA-256 para a senha fornecida.
 *
 * Implementação algorítmica:
 * 1. Utilities.computeDigest retorna um array de bytes assinados (−128 a 127).
 * 2. Aplica-se complemento de dois: (byte < 0) ? 256 + byte : byte.
 * 3. Converte cada byte para base 16 com padding .slice(-2) para evitar
 *    falhas de colisão em hashes cujo byte resulte em 1 dígito hex.
 *
 * @param {string} password A senha em texto plano.
 * @return {string} O hash hexadecimal de 64 caracteres (256 bits).
 */
function hashPassword(password) {
  const rawDigest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    password,
    Utilities.Charset.UTF_8
  );
  // Mapeamento para hex com complemento de dois e zero-padding
  return rawDigest
    .map(function(byte) {
      const unsigned = byte < 0 ? 256 + byte : byte;
      return ('0' + unsigned.toString(16)).slice(-2);
    })
    .join('');
}

/**
 * Valida o login do usuário comparando o hash da senha fornecida
 * com o hash armazenado na coluna SenhaHash da aba Usuarios.
 *
 * Otimização: carrega todos os dados em lote (getDataRange().getValues())
 * para evitar chamadas individuais à API do Google Sheets.
 *
 * @param {string} user O nome de usuário.
 * @param {string} pass A senha fornecida em texto plano.
 * @return {Object} Resultado da validação: { success: boolean, message: string }.
 */
function validateLogin(user, pass) {
  if (!user || !pass) {
    return { success: false, message: 'Usuário e senha são obrigatórios.' };
  }

  try {
    const sheet = SpreadsheetApp.openById(getSpreadsheetId())
      .getSheetByName(SHEET_NAMES.USUARIOS);
    if (!sheet) {
      return { success: false, message: 'Aba de usuários não encontrada.' };
    }

    const data = sheet.getDataRange().getValues();
    const passwordHash = hashPassword(pass);

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === user && data[i][1] === passwordHash) {
        logEvent('Login bem-sucedido: ' + user, 'Auth');
        return { success: true, message: 'Autenticação realizada.' };
      }
    }

    logEvent('Tentativa de login falhou: ' + user, 'Auth');
    return { success: false, message: 'Credenciais inválidas.' };
  } catch (e) {
    logError('Erro no login: ' + e.message, 'Auth');
    return { success: false, message: 'Erro interno de autenticação.' };
  }
}

/**
 * Registra um novo usuário na aba Usuarios com hash SHA-256 da senha.
 * @param {string} user O nome de usuário desejado.
 * @param {string} pass A senha escolhida.
 * @return {Object} Resultado do registro: { success: boolean, message: string }.
 */
function registerUser(user, pass) {
  if (!user || !pass) {
    return { success: false, message: 'Usuário e senha são obrigatórios.' };
  }
  if (pass.length < 8) {
    return { success: false, message: 'A senha deve ter no mínimo 8 caracteres.' };
  }

  try {
    const sheet = SpreadsheetApp.openById(getSpreadsheetId())
      .getSheetByName(SHEET_NAMES.USUARIOS);
    const data = sheet.getDataRange().getValues();

    // Verifica se o usuário já existe (leitura em lote)
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === user) {
        return { success: false, message: 'Usuário já cadastrado.' };
      }
    }

    const passwordHash = hashPassword(pass);
    sheet.appendRow([user, passwordHash, new Date()]);
    logEvent('Novo usuário registrado: ' + user, 'Auth');
    return { success: true, message: 'Usuário registrado com sucesso.' };
  } catch (e) {
    logError('Erro no registro: ' + e.message, 'Auth');
    return { success: false, message: 'Erro interno no registro.' };
  }
}

/**
 * Ponto de entrada para o Web App. Serve a interface de login.
 * Deploy como webapp com credenciais do usuário ativo (OAuth scopes mínimos).
 * @return {HtmlOutput} A interface de usuário do login.
 */
function doGet() {
  return HtmlService.createTemplateFromFile('Login')
    .evaluate()
    .setTitle('Login - Quinto Poder')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
