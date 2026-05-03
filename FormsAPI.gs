/**
 * @file FormsAPI.gs
 * @description Geração dinâmica de formulários Google Forms para coleta de dados
 *              psicométricos. Consome o array de 105 questões de Questions.gs e
 *              utiliza form.addScaleItem() com limites 1–10 conforme a arquitetura
 *              documentada. UUID é atribuído como chave primária PerfilID e as
 *              respostas são serializadas via JSON.stringify() em coluna única.
 * @module Módulo2_Formularios
 * @see Ref 42: Forms Service — Google for Developers
 * @see Ref 43: Adding different types of questions — Medium
 * @see Ref 45: Class SpreadsheetTriggerBuilder — Google for Developers
 * @version 2.0.0
 * @date 2026-03-15
 */

/**
 * Cria um novo formulário Google Forms para o diagnóstico político-econômico
 * de 105 questões. Cada questão é criada com addScaleItem() em escala 1–10.
 * O formulário é configurado como quiz desabilitado (apenas coleta).
 * @return {string} O ID do formulário criado.
 */
function createDiagnosticForm() {
  const form = FormApp.create('Diagnóstico Político-Econômico');
  form.setTitle('Diagnóstico Político-Econômico')
    .setDescription(
      'Questionário com ' + LIMITS.MAX_QUESTIONS + ' questões objetivas ' +
      'para mensurar sua inclinação perante dogmas de mercado e regulação estatal. ' +
      'Responda cada item na escala de 1 (Discordo Totalmente) a 10 (Concordo Totalmente).'
    )
    .setConfirmationMessage(
      'Obrigado pelas respostas. Seu perfil está sendo processado. ' +
      'Seu PerfilID será gerado automaticamente.'
    )
    .setCollectEmail(false)
    .setAllowResponseEdits(false);

  const questions = getDiagnosticQuestions();

  // Loop construtor iterando sobre o JSON estruturado de questões
  questions.forEach(function(q) {
    const item = form.addScaleItem();
    item.setTitle(q.title)
      .setBounds(LIMITS.SCALE_MIN, LIMITS.SCALE_MAX)
      .setLabels('Discordo Totalmente', 'Concordo Totalmente')
      .setRequired(true);

    // Se a questão possui helpText (contexto adicional), aplica-o
    if (q.helpText) {
      item.setHelpText(q.helpText);
    }
  });

  // Configura o gatilho instalável de submissão via ScriptApp
  setupFormSubmitTrigger(form.getId());

  logEvent('Formulário criado: ' + form.getId(), 'FormsAPI');
  return form.getId();
}

/**
 * Configura um gatilho instalável para disparar quando o formulário for submetido.
 * Utiliza ScriptApp.newTrigger().forForm().onFormSubmit().create() conforme Ref 45.
 * @param {string} formId O ID do formulário.
 */
function setupFormSubmitTrigger(formId) {
  // Verifica se já existe um trigger para este formulário (evita duplicatas)
  const existingTriggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < existingTriggers.length; i++) {
    if (existingTriggers[i].getHandlerFunction() === 'onFormSubmitHandler' &&
        existingTriggers[i].getTriggerSourceId() === formId) {
      Logger.log('Trigger já existente para formulário: ' + formId);
      return;
    }
  }

  ScriptApp.newTrigger('onFormSubmitHandler')
    .forForm(formId)
    .onFormSubmit()
    .create();

  logEvent('Trigger de submissão configurado para form: ' + formId, 'FormsAPI');
}

/**
 * Handler disparado quando o formulário de diagnóstico é submetido.
 * Extrai as respostas, gera um UUID como PerfilID, serializa o conjunto
 * denso de 105 respostas via JSON.stringify() e persiste na coluna
 * RespostasJSON da aba Perfis (evitando criar 105 colunas distintas).
 * @param {Object} e O evento de submissão do formulário.
 */
function onFormSubmitHandler(e) {
  try {
    const responses = e.response.getItemResponses();
    const answers = {};

    responses.forEach(function(response) {
      const title = response.getItem().getTitle();
      // Converte a resposta para Number (o Forms retorna string para ScaleItem)
      const value = Number(response.getResponse());
      answers[title] = isNaN(value) ? 0 : value;
    });

    // Gera Identificador Único Universal como chave primária PerfilID
    const perfilId = Utilities.getUuid();
    const answersJson = JSON.stringify(answers);

    // Persistência na aba Perfis — serialização JSON é essencial para manter
    // a arquitetura de dados plana e de alta performance
    saveProfileToSheet(perfilId, answersJson);

    logEvent('Formulário submetido. PerfilID: ' + perfilId, 'FormsAPI');
  } catch (e) {
    logError('Erro ao processar submissão do formulário: ' + e.message, 'FormsAPI');
  }
}
