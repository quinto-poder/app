# Projeto: Quinto Poder

## Descrição do Projeto
O **Quinto Poder** é uma plataforma de auditoria epistêmica e transparência democrática, projetada para identificar e mitigar o viés cognitivo na análise de fatos de interesse público. Através de uma arquitetura integrada entre Google Apps Script e Google Colab, o sistema processa perfis psicométricos e ponderações factuais em tempo real, utilizando algoritmos de Machine Learning para detectar dissonâncias entre princípios teóricos e julgamentos práticos. O caso do Banco Master é utilizado como um exemplo pedagógico para demonstrar como a plataforma pode expor a seletividade mediática e promover uma consciência analítica superior entre os eleitores.

## Palavras-chave
*   **Auditoria Epistêmica**
*   **Transparência Algorítmica**
*   **Viés Cognitivo**
*   **Inteligência Coletiva**

---

## Estrutura do Projeto (Pasta Raiz)
Todos os componentes estão localizados na raiz do projeto para facilitar o deploy no Google Apps Script:

*   **Lógica de Backend (.gs):**
    *   `Auth.gs`: Autenticação e segurança.
    *   `Properties.gs`: Configurações de ambiente.
    *   `FormsAPI.gs`: Geração de formulários dinâmicos.
    *   `Questions.gs`: Banco de 105 questões psicométricas.
    *   `CRUD.gs`: Operações de banco de dados no Sheets.
    *   `Dissonance.gs`: Cálculo de incoerência ideológica.
    *   `Gamification.gs`: Sistema de recompensas e badges.
    *   `Facts.gs`: Base de dados de fatos (Ex: Banco Master).
    *   `ColabIntegration.gs`: Ponte de comunicação com o Colab.
    *   `Triggers.gs`: Automação via gatilhos nativos.
    *   `QuintoPoder.gs`: Agregação de tendências e dashboard.
    *   `Helpers.gs` & `Constants.gs`: Utilitários e padrões.
    *   `Validator.gs`: Ferramentas de integridade.

*   **Interfaces de Usuário (.html):**
    *   `Login.html`: Acesso ao sistema.
    *   `Questionnaire.html`: Coleta de perfil psicométrico.
    *   `StressTest.html`: Interface de ponderação de fatos.
    *   `Dashboard.html`: Visualização pública do "Quinto Poder".

*   **Processamento Externo:**
    *   `notebook.py`: Microserviço de ML para execução no Google Colab.

## Instruções de Configuração
1.  **Google Sheets:** Crie uma planilha e execute `initializeProperties()` em `Properties.gs` com o ID da planilha.
2.  **Validator:** Execute `repairSheetStructure()` em `Validator.gs` para criar as abas necessárias.
3.  **Google Colab:** Execute `notebook.py` em uma célula do Colab e insira a URL do ngrok na propriedade `COLAB_URL` do script.
4.  **Deploy:** Publique como Web App no Google Apps Script.
