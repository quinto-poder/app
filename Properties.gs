/**
 * @file Properties.gs
 * @description Gerenciamento seguro de estado via PropertiesService com camada
 *              de cache in-memory para mitigar a latência de ~30 ms (leitura)
 *              e ~64 ms (escrita) documentada nas referências de performance.
 *              A persistência permanente do PropertiesService é mandatória sobre
 *              o CacheService, pois chaves de API não podem expirar.
 * @module Módulo1_Autenticacao
 * @see Ref 35: Class PropertiesService — Google for Developers
 * @see Ref 37: Google Apps Script APIs performance — Luis Peralta
 * @version 2.0.0
 * @date 2026-03-15
 */

/**
 * Cache in-memory para evitar chamadas repetidas ao PropertiesService
 * dentro da mesma execução do script. O cache vive apenas durante o
 * runtime de uma única invocação (máx. 6 min no GAS).
 * @private
 */
const _propsCache = {};

/**
 * Obtém uma propriedade do script com cache in-memory.
 * Na primeira chamada, consulta o PropertiesService (~30 ms);
 * nas chamadas subsequentes, retorna do cache (~0 ms).
 * @param {string} key A chave da propriedade.
 * @return {string|null} O valor da propriedade ou null se não existir.
 */
function getScriptProperty(key) {
  if (_propsCache.hasOwnProperty(key)) {
    return _propsCache[key];
  }
  const value = PropertiesService.getScriptProperties().getProperty(key);
  _propsCache[key] = value;
  return value;
}

/**
 * Define propriedades globais do script em lote (operação única de escrita).
 * Invalida o cache in-memory para as chaves afetadas.
 * @param {Object<string, string>} props Pares chave-valor a persistir.
 */
function setScriptProperties(props) {
  PropertiesService.getScriptProperties().setProperties(props);
  // Invalida cache para refletir os novos valores
  for (const key in props) {
    if (props.hasOwnProperty(key)) {
      _propsCache[key] = props[key];
    }
  }
}

/**
 * Obtém o ID da Google Sheet configurado nas propriedades do script.
 * Utiliza a chave canônica PROP_KEYS.SPREADSHEETS_ID.
 * @return {string} O ID da planilha.
 * @throws {Error} Se a propriedade não estiver configurada.
 */
function getSpreadsheetId() {
  const id = getScriptProperty(PROP_KEYS.SPREADSHEETS_ID);
  if (!id) {
    throw new Error('SPREADSHEETS_ID não configurado. Execute initializeProperties() primeiro.');
  }
  return id;
}

/**
 * Obtém a URL do endpoint do Google Colab (via ngrok/pyngrok).
 * @return {string} A URL pública criptografada gerada por ngrok.connect(8080).
 * @throws {Error} Se a propriedade não estiver configurada.
 */
function getColabUrl() {
  const url = getScriptProperty(PROP_KEYS.COLAB_URL);
  if (!url) {
    throw new Error('COLAB_URL não configurado. Execute initializeProperties() primeiro.');
  }
  return url;
}

/**
 * Inicializa as propriedades do script com valores-placeholder.
 * Deve ser executada uma única vez pelo desenvolvedor antes do primeiro deploy.
 * Após a execução, o desenvolvedor deve substituir os placeholders pelos
 * valores reais via PropertiesService ou pela interface do GAS.
 */
function initializeProperties() {
  const initialProps = {};
  initialProps[PROP_KEYS.SPREADSHEETS_ID]       = 'SUA_SPREADSHEET_ID_AQUI';
  initialProps[PROP_KEYS.COLAB_URL]             = 'SUA_URL_NGROK_AQUI';
  initialProps[PROP_KEYS.GOOGLE_FORMS_API_KEY]  = 'SUA_FORMS_API_KEY_AQUI';
  initialProps[PROP_KEYS.GOOGLE_SHEETS_API_KEY] = 'SUA_SHEETS_API_KEY_AQUI';
  setScriptProperties(initialProps);
  Logger.log('Propriedades inicializadas com placeholders. Substitua pelos valores reais.');
}
