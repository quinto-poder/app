/**
 * @file Constants.gs
 * @description Constantes globais do projeto para manter consistência e facilitar alterações.
 *              Todas as constantes são congeladas (Object.freeze) para garantir imutabilidade
 *              em runtime V8, prevenindo mutações acidentais em módulos dependentes.
 * @module Utils
 * @version 2.0.0
 * @date 2026-03-15
 */

/**
 * Constantes de nomes de abas na planilha Google Sheets.
 * Cada aba corresponde a uma camada do sistema de ponderação epistêmica.
 */
const SHEET_NAMES = Object.freeze({
  USUARIOS:      'Usuarios',
  PERFIS:        'Perfis',
  FATOS:         'Fatos',
  DISSONANCIA:   'Dissonancia',
  ANALISES:      'Analises',
  QUINTO_PODER:  'QuintoPoder',
  NOTICIAS:      'Noticias',
  AUDITORIA:     'Auditoria',
  PONTOS:        'Pontos',
  CUMPLICIDADE:  'Cumplicidade',
  OMISSOES:      'Omissoes'
});

/**
 * Constantes de limites e parâmetros globais do sistema.
 * MAX_QUESTIONS: 105 questões psicométricas (Módulo 2).
 * MAX_FACTS_PER_TEST: subconjunto aleatório de fatos no teste de estresse (Módulo 4).
 * SCALE_MIN / SCALE_MAX: limites das escalas Likert (1–10) em Forms e sliders.
 * GAS_EXEC_TIMEOUT_MS: margem de segurança para o limite de 6 min do GAS runtime.
 */
const LIMITS = Object.freeze({
  MAX_QUESTIONS:      120,
  MAX_FACTS_PER_TEST: 12,
  SCALE_MIN:          1,
  SCALE_MAX:          10,
  GAS_EXEC_TIMEOUT_MS: 330000,
  TOTAL_AXES:         8
});

/**
 * Limiares (thresholds) para classificação de badges de gamificação.
 * Derivados da fórmula: score = abs(Peso_Esquerda − Peso_Direita).
 * Score tendendo a zero → objetividade; score elevado → miopia política.
 */
const BADGE_THRESHOLDS = Object.freeze({
  ANALYST:  10,
  MODERATE: 30,
  BIASED:   60
});

/**
 * Constantes de classificação ideológica atribuída aos fatos (Módulo 4).
 * O peso intrínseco de cada fato é invisível ao usuário;
 * a classificação determina a qual somatório (esquerda/direita) o slider contribui.
 */
const IDEOLOGY = Object.freeze({
  ESQUERDA:  'ESQUERDA',
  DIREITA:   'DIREITA',
  NEUTRO:    'NEUTRO',
  SISTEMICO: 'SISTEMICO'
});

/**
 * Nomes canônicos dos badges de gamificação (Módulo 4).
 */
const BADGES = Object.freeze({
  ANALYST:   'Analista Factual',
  MODERATE:  'Observador Moderado',
  BIASED:    'Tendencioso',
  BLIND:     'Militante Cego',
  COMPLICIT: 'Cúmplice Silencioso'
});

/**
 * Chaves canônicas do PropertiesService (Módulo 1).
 * Centraliza as strings para evitar erros de digitação.
 */
const PROP_KEYS = Object.freeze({
  SPREADSHEETS_ID:      'SPREADSHEETS_ID',
  COLAB_URL:            'COLAB_URL',
  GOOGLE_FORMS_API_KEY: 'GOOGLE_FORMS_API_KEY',
  GOOGLE_SHEETS_API_KEY:'GOOGLE_SHEETS_API_KEY'
});

/**
 * Constantes HTTP para integração com o Google Colab (Módulo 5).
 */
const HTTP = Object.freeze({
  METHOD_POST:   'post',
  CONTENT_JSON:  'application/json',
  MAX_RETRIES:   3,
  RETRY_DELAY_MS: 2000
});
