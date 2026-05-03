/**
 * @file Triggers.gs
 * @description Configuração e gerenciamento de gatilhos nativos do GAS.
 *              Implementa triggers baseados em tempo (time-driven) para
 *              classificação horária e triggers simples (onEdit) para
 *              reprocessamento de ponderações alteradas na planilha.
 * @module Módulo6_Gatilhos_QuintoPoder
 * @see Ref 50: Master Triggers in Google Apps Script
 * @see Ref 54: Simple Triggers — Google for Developers
 * @version 2.0.0
 * @date 2026-03-15
 */

/**
 * Cria um gatilho baseado no tempo para executar a rotina de classificação
 * a cada hora. Verifica se o trigger já existe para evitar duplicatas.
 */
function setupHourlyTrigger() {
  // Verifica duplicatas
  const existing = ScriptApp.getProjectTriggers();
  for (let i = 0; i < existing.length; i++) {
    if (existing[i].getHandlerFunction() === 'hourlyClassificationRoutine') {
      Logger.log('Trigger horário já existe. Pulando criação.');
      return;
    }
  }

  ScriptApp.newTrigger('hourlyClassificationRoutine')
    .timeBased()
    .everyHours(1)
    .create();

  logEvent('Trigger horário criado para classificação.', 'Triggers');
}

/**
 * Cria um gatilho diário para reengajamento (notificação/processamento).
 * O doc menciona "ativado por um gatilho diário (time-driven trigger)".
 */
function setupDailyTrigger() {
  const existing = ScriptApp.getProjectTriggers();
  for (let i = 0; i < existing.length; i++) {
    if (existing[i].getHandlerFunction() === 'dailyReengagementRoutine') {
      Logger.log('Trigger diário já existe. Pulando criação.');
      return;
    }
  }

  ScriptApp.newTrigger('dailyReengagementRoutine')
    .timeBased()
    .everyDays(1)
    .atHour(9) // 9h da manhã
    .create();

  logEvent('Trigger diário criado para reengajamento.', 'Triggers');
}

/**
 * Rotina executada a cada hora para atualizar o ranking do QuintoPoder.
 * Puxa todos os dados processados, elabora ranking decrescente de Score de Viés
 * e atualiza dashboards públicos em uma ÚNICA transação setValues()
 * (eliminando o anti-pattern de appendRow dentro de loops).
 */
function hourlyClassificationRoutine() {
  try {
    const profiles = readAllProfiles();
    if (profiles.length === 0) {
      Logger.log('Nenhum perfil para classificar.');
      return;
    }

    // Processa o ranking em memória
    const now = new Date();
    const ranking = profiles.map(function(profile) {
      let score = 0;
      try {
        const answers = JSON.parse(profile[1]);
        score = calculateWeightedAverage(answers);
      } catch (e) {
        // Se o JSON for inválido, score permanece 0
      }
      return [profile[0], score, now];
    });

    // Ordena por score decrescente
    ranking.sort(function(a, b) { return b[1] - a[1]; });

    // Escrita em bloco: cabeçalho + dados em UMA transação setValues()
    const sheet = getSheet(SHEET_NAMES.QUINTO_PODER);
    sheet.clear();

    const header = [['ID Perfil', 'Score de Viés', 'Última Atualização']];
    const allData = header.concat(ranking);
    sheet.getRange(1, 1, allData.length, 3).setValues(allData);

    // Formata cabeçalho em negrito
    sheet.getRange(1, 1, 1, 3).setFontWeight('bold');

    logEvent('Ranking atualizado: ' + ranking.length + ' perfis classificados.', 'Triggers');
  } catch (e) {
    logError('Erro na classificação horária: ' + e.message, 'Triggers');
  }
}

/**
 * Rotina diária de reengajamento. Verifica usuários que não retornaram
 * e pode disparar lógica de notificação futura.
 */
function dailyReengagementRoutine() {
  try {
    const profiles = readAllProfiles();
    const now = new Date();
    let staleCount = 0;

    profiles.forEach(function(profile) {
      const lastActivity = new Date(profile[2]);
      const daysSince = (now - lastActivity) / (1000 * 60 * 60 * 24);
      if (daysSince > 7) {
        staleCount++;
      }
    });

    logEvent('Reengajamento diário: ' + staleCount + ' perfis inativos há >7 dias.', 'Triggers');
  } catch (e) {
    logError('Erro no reengajamento diário: ' + e.message, 'Triggers');
  }
}

/**
 * Gatilho simples onEdit: disparado sempre que a planilha é editada.
 * Se as ponderações forem alteradas na aba Perfis, dispara a análise do Colab.
 * @param {Object} e O evento de edição da planilha.
 */
function onEdit(e) {
  try {
    const range = e.range;
    const sheetName = range.getSheet().getName();

    // Dispara reprocessamento apenas para edições na aba Perfis
    if (sheetName === SHEET_NAMES.PERFIS) {
      const row = range.getRow();
      if (row > 1) { // Ignora edições no cabeçalho
        const perfilId = range.getSheet().getRange(row, 1).getValue();
        if (perfilId) {
          executeColabAnalysis(perfilId);
        }
      }
    }
  } catch (e) {
    // onEdit simples não pode logar em planilhas externas (limitação GAS)
    Logger.log('Erro no onEdit: ' + e.message);
  }
}

/**
 * Remove todos os triggers do projeto (para limpeza/reset).
 */
function removeAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    ScriptApp.deleteTrigger(trigger);
  });
  logEvent('Todos os triggers removidos (' + triggers.length + ').', 'Triggers');
}
