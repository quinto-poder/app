# -*- coding: utf-8 -*-
"""
@file notebook.py
@description Microserviço de Machine Learning para o Projeto Quinto Poder.
             Execute todo este código em uma única célula do Google Colab.
             Instala dependências, treina o modelo, inicia Flask e expõe via ngrok.
@version 2.0.0
@date 2026-03-15

INSTRUÇÕES DE USO:
1. Copie este código para uma única célula no Google Colab.
2. (Opcional) Configure seu NGROK_AUTHTOKEN:
      a. Via Colab Secrets (cadeado na barra lateral) → chave "NGROK_AUTHTOKEN", ou
      b. Via variável de ambiente: os.environ["NGROK_AUTHTOKEN"] = "seu_token"
3. Execute a célula.
4. Copie a URL pública exibida e configure-a como propriedade "COLAB_URL"
   no Google Apps Script (Properties.gs → initializeProperties).

ENDPOINTS:
  GET  /         — Informações do serviço.
  GET  /health   — Verificação de disponibilidade (usado por testColabEndpoint() no GAS).
  POST /analyze  — Análise psicométrica + ponderação epistêmica dos fatos do Banco Master.
"""

import os
import sys
import time
import subprocess
import threading

# ─── Instalação de Dependências ──────────────────────────────────────────────

def _install_packages():
    pkgs = ["pyngrok", "flask", "flask-cors", "scikit-learn", "numpy"]
    subprocess.check_call(
        [sys.executable, "-m", "pip", "install", "--quiet"] + pkgs
    )

try:
    from flask import Flask, request, jsonify
    from flask_cors import CORS
    from pyngrok import ngrok
    import numpy as np
    from sklearn.cluster import KMeans
    from sklearn.decomposition import PCA
    from sklearn.preprocessing import StandardScaler
except ImportError:
    print("Instalando dependências…")
    _install_packages()
    from flask import Flask, request, jsonify
    from flask_cors import CORS
    from pyngrok import ngrok
    import numpy as np
    from sklearn.cluster import KMeans
    from sklearn.decomposition import PCA
    from sklearn.preprocessing import StandardScaler

# ─── Títulos Canônicos das 105 Questões (espelho de Questions.gs) ─────────────
#
# A ordem é a mesma de getDiagnosticQuestions() em Questions.gs.
# As chaves recebidas em perfil_data.answers são estes títulos exatos.

QUESTION_TITLES = [
    # Eixo 1 (Q1–Q15): Regulação Financeira e Banco Central
    "O mercado financeiro se autorregula sem necessidade de um Banco Central ativo.",
    "A autonomia do Banco Central é essencial para a estabilidade econômica.",
    "O FGC protege adequadamente os pequenos investidores.",
    "Taxas de CDB acima de 130% do CDI são sinal de risco sistêmico.",
    "A fiscalização do BC deveria impedir instituições de oferecer taxas irreais.",
    "A concentração bancária é prejudicial à competitividade do setor financeiro.",
    "Bancos de médio porte devem ter exigências de capital tão rigorosas quanto grandes bancos.",
    "A emissão de CDBs sem lastro deveria ser criminalizada.",
    "O limite de R$ 250 mil do FGC por CPF é suficiente para proteger investidores de varejo.",
    "A supervisão prudencial do BC falhou em detectar deterioração de liquidez em instituições recentes.",
    "Operações interbancárias com carteiras de crédito deveriam ser auditadas por entidades independentes.",
    "O sigilo bancário deve prevalecer durante investigações de fraude financeira.",
    "A política monetária deve ser determinada por critérios técnicos, sem interferência política.",
    "O BC deveria poder vetar fusões que concentrem risco sistêmico.",
    "A reposição do FGC após crise bancária encarece o crédito para toda a sociedade.",
    # Eixo 2 (Q16–Q30): Papel do Estado na Economia
    "A intervenção estatal é necessária para prevenir crises financeiras.",
    "Bancos públicos devem poder socorrer bancos privados em dificuldade.",
    "A privatização de bancos estatais reduziria a corrupção no setor.",
    "Fundos de previdência devem ser impedidos de investir em títulos de bancos de médio porte.",
    "O Estado deve resgatar depositantes quando um banco privado falir.",
    "A desregulamentação financeira de governos recentes contribuiu para fraudes.",
    "Políticas de livre mercado geram mais benefícios que riscos ao sistema financeiro.",
    "O governo deveria estabelecer tetos para taxas de captação.",
    "Parcerias Público-Privadas em infraestrutura financeira geram conflitos de interesse.",
    "O Estado é diretamente responsável quando pensionistas perdem recursos em bancos sem garantia.",
    "A abertura de capital de bancos menores deveria ser incentivada para transparência.",
    "Governos de esquerda são mais eficazes na regulação do mercado financeiro.",
    "Governos de direita criam condições para fraudes por desregulamentação excessiva.",
    "A tributação de grandes fortunas poderia financiar proteção ao investidor.",
    "A autonomia de bancos estatais é comprometida por nomeações políticas.",
    # Eixo 3 (Q31–Q45): Justiça e Accountability
    "Ministros do STF com contratos investigados devem se declarar impedidos automaticamente.",
    "A prisão preventiva de executivos financeiros antes da condenação é justificável.",
    "Parentes de autoridades não devem prestar serviços a instituições sob investigação.",
    "A delação premiada é eficaz para combater crimes de colarinho branco.",
    "O foro privilegiado protege indevidamente autoridades em crimes financeiros.",
    "Investigações de fraude devem ter acesso irrestrito a dados bancários.",
    "Sigilo judicial em casos de fraude bancária prejudica o interesse público.",
    "Magistrados que se declaram suspeitos tardiamente deveriam sofrer sanções.",
    "A PF é a instituição mais preparada para investigar crimes financeiros complexos.",
    "Milícias privadas contratadas por banqueiros configuram crime hediondo.",
    "Consultorias milionárias de ex-ministros a bancos constituem tráfico de influência.",
    "O COAF deve ter mais autonomia para rastrear movimentações suspeitas.",
    "Evasão para paraísos fiscais durante investigações deveria gerar bloqueio imediato.",
    "O TCU deveria investigar decisões do liquidante do Banco Central.",
    "A punição para colarinho branco é desproporcional comparada a crimes comuns.",
    # Eixo 4 (Q46–Q60): Transparência e Fiscalização
    "Doações eleitorais de executivos do setor financeiro deveriam ser proibidas.",
    "Lobbying para alterar limites do FGC configura crime econômico.",
    "Dados do COAF sobre movimentações de políticos devem ser públicos.",
    "Empresas de fachada para simular carteiras devem gerar responsabilidade solidária.",
    "Auditorias externas obrigatórias previnem fraudes em balanços financeiros.",
    "Transparência corporativa é mais importante que lucro dos acionistas.",
    "Órgãos reguladores devem publicar relatórios de risco em tempo real.",
    "O jornalismo investigativo é o principal instrumento de exposição de fraudes.",
    "Whistleblowers de fraudes financeiras devem receber proteção legal abrangente.",
    "Gestões de fundos de previdência estaduais devem ser obrigatoriamente auditadas.",
    "CPIs são eficazes para fiscalizar o setor financeiro.",
    "Nomeação de diretores do BC deveria exigir quarentena do setor privado.",
    "Offshores de controladores de bancos deveriam ser reportadas ao COAF automaticamente.",
    "O sistema brasileiro de registro empresarial facilita ocultação de patrimônio.",
    "Relatórios do BC sobre instituições em dificuldade devem ser divulgados antes da liquidação.",
    # Eixo 5 (Q61–Q75): Mídia, Informação e Viés
    "A cobertura da mídia sobre escândalos financeiros é frequentemente enviesada.",
    "Veículos de comunicação omitem seletivamente fatos para proteger aliados políticos.",
    "Bolhas algorítmicas dificultam a compreensão factual de crises.",
    "Redes sociais são fontes confiáveis sobre fraudes financeiras.",
    "Cidadãos avaliam objetivamente crises financeiras sem ferramentas de auditoria.",
    "A desinformação sobre o sistema financeiro é mais perigosa que a própria fraude.",
    "O fact-checking é eficaz contra narrativas enviesadas sobre crises bancárias.",
    "Analistas econômicos de TV são mais influenciados por patrocinadores que por evidências.",
    "A polarização política impede responsabilização bipartidária em escândalos.",
    "Jornalistas que expõem fraudes devem ter proteção estatal contra intimidação.",
    "A concentração de propriedade de mídia compromete imparcialidade na cobertura financeira.",
    "É possível avaliar objetivamente fatos que implicam seu próprio espectro político.",
    "Algoritmos são mais confiáveis que jornalistas para detectar viés mediático.",
    "Acesso a documentos processuais é mais importante que privacidade dos envolvidos.",
    "Cegueira tribal é o maior obstáculo à verdade factual.",
    # Eixo 6 (Q76–Q90): Governança Corporativa e Ética
    "Banqueiros fraudadores devem ser permanentemente banidos do mercado financeiro.",
    "Empresas de fachada para inflar patrimônio geram responsabilidade criminal solidária.",
    "Remuneração variável de executivos bancários contribui para riscos excessivos.",
    "Conselheiros independentes em bancos de médio porte deveriam ser obrigatórios.",
    "Lucros privatizados e prejuízos socializados são inerentes ao capitalismo financeiro.",
    "Códigos de ética voluntários são insuficientes para prevenir fraudes financeiras.",
    "A estrutura de incentivos bancários favorece comportamentos predatórios de captação.",
    "Bancos com taxas acima da média devem ser monitorados em tempo real.",
    "O compliance atual das instituições financeiras é apenas cosmético.",
    "Separação entre banco comercial e de investimento reduziria risco sistêmico.",
    "Holdings financeiras devem publicar balanços consolidados trimestrais.",
    "O sistema financeiro brasileiro é resiliente a crises do porte do caso Master.",
    "A interconexão entre instituições amplifica risco de contágio sistêmico.",
    "Responsabilidade criminal de sócios controladores deveria ser presumida em fraude contábil.",
    "Liquidação extrajudicial é o mecanismo mais eficiente para insolvências bancárias.",
    # Eixo 7 (Q91–Q105): Direitos do Consumidor e Proteção do Investidor
    "Investidores de varejo são as principais vítimas de captação fraudulenta.",
    "Educação financeira é suficiente para proteger cidadãos de fraudes bancárias.",
    "Quem investe em CDBs com taxas irreais assume parte do risco de perda.",
    "Seguradoras devem cobrir perdas de investidores em fraude bancária comprovada.",
    "Pensionistas estaduais merecem proteção especial contra gestores negligentes.",
    "Proteção do investidor é mais importante que liberdade de captação dos bancos.",
    "O aumento do FGC para R$ 1 milhão beneficiaria exclusivamente grandes aplicadores.",
    "Plataformas devem ser responsabilizadas por distribuir produtos de bancos insolventes.",
    "O investidor tem direito à informação completa sobre a saúde financeira do emissor.",
    "Ações coletivas de investidores lesados são mais eficientes que processos individuais.",
    "A velocidade de ressarcimento pelo FGC é tão importante quanto o montante garantido.",
    "O efeito contracionista do resgate pelo FGC é um preço aceitável pela estabilidade.",
    "Regulação financeira deve priorizar o consumidor sobre a liberdade operacional dos bancos.",
    "O sistema financeiro deveria ter um canal público de denúncias acessível a qualquer cidadão.",
    "A gravidade do escândalo Master justifica criação de uma CPMI no Congresso.",
]

assert len(QUESTION_TITLES) == 105, "QUESTION_TITLES deve conter exatamente 105 entradas."

# ─── Perfis Ideológicos e Centroides do K-Means ──────────────────────────────
#
# Cinco perfis são definidos como centroides iniciais para o K-Means, um por
# posição no espectro regulação↔mercado × intervencionismo↔liberalismo.
# Os valores são médias esperadas na escala Likert 1–10 por eixo temático.
#
# Eixos:
#   1: Regulação Financeira e Banco Central
#   2: Papel do Estado na Economia
#   3: Justiça e Accountability
#   4: Transparência e Fiscalização
#   5: Mídia, Informação e Viés
#   6: Governança Corporativa e Ética
#   7: Direitos do Consumidor e Proteção do Investidor

PROFILE_NAMES = [
    "Progressista-Regulacionista",  # 0
    "Social-Democrata",             # 1
    "Liberal-Tecnocrático",         # 2
    "Conservador-Mercadista",       # 3
    "Apolítico-Pragmático",         # 4
]

# Médias por eixo: linhas = perfis (0–4), colunas = eixos (1–7)
_AXIS_MEANS = np.array([
    [8.0, 8.5, 9.0, 9.0, 8.5, 8.5, 8.5],  # 0: Progressista-Regulacionista
    [6.5, 6.5, 7.5, 7.5, 7.0, 7.0, 7.5],  # 1: Social-Democrata
    [5.0, 4.5, 7.0, 6.5, 6.5, 6.5, 6.0],  # 2: Liberal-Tecnocrático
    [3.5, 3.0, 5.0, 5.0, 5.0, 5.0, 5.0],  # 3: Conservador-Mercadista
    [5.5, 5.5, 6.5, 6.5, 6.0, 6.5, 6.0],  # 4: Apolítico-Pragmático
])

_QUESTIONS_PER_AXIS = 15  # 7 eixos × 15 questões = 105

def _centroid_from_axis_means(axis_means: np.ndarray) -> np.ndarray:
    """Expande 7 médias por eixo em um vetor de 105 valores."""
    return np.repeat(axis_means, _QUESTIONS_PER_AXIS)

_CENTROIDS_RAW = np.array(
    [_centroid_from_axis_means(m) for m in _AXIS_MEANS]
)  # shape (5, 105)

def _generate_training_data(n_per_cluster: int = 200, seed: int = 42) -> np.ndarray:
    """
    Gera dataset sintético em torno dos 5 centroides ideológicos (σ = 1.2).
    Produz 1 000 amostras balanceadas para treinar K-Means e PCA.
    """
    rng = np.random.default_rng(seed)
    slices = []
    for centroid in _CENTROIDS_RAW:
        noise = rng.normal(loc=0.0, scale=1.2, size=(n_per_cluster, 105))
        slices.append(np.clip(centroid + noise, 1.0, 10.0))
    return np.vstack(slices)  # (5 * n_per_cluster, 105)

# ─── Treinamento do Modelo (executado uma vez na inicialização) ───────────────

print("Treinando modelo K-Means + PCA…")
_X_TRAIN  = _generate_training_data()
_SCALER   = StandardScaler()
_X_SCALED = _SCALER.fit_transform(_X_TRAIN)

# Inicializa K-Means com os centroides ideológicos (n_init=1 → determinístico)
_KMEANS = KMeans(
    n_clusters=5,
    init=_SCALER.transform(_CENTROIDS_RAW),
    n_init=1,
    random_state=42,
    max_iter=300,
)
_KMEANS.fit(_X_SCALED)

_PCA = PCA(n_components=2)
_PCA.fit(_X_SCALED)
print("Modelo pronto.")

# ─── Funções de Análise ───────────────────────────────────────────────────────

def _build_answer_vector(answers: dict) -> np.ndarray:
    """
    Constrói o vetor ordenado de 105 floats a partir do dict {titulo: valor}.
    Títulos ausentes recebem imputação pela média da escala (5.5).
    Espelha a estrutura de getDiagnosticQuestions() em Questions.gs.
    """
    vec = np.full(105, 5.5)
    for i, title in enumerate(QUESTION_TITLES):
        raw = answers.get(title)
        if raw is not None:
            try:
                vec[i] = float(raw)
            except (TypeError, ValueError):
                pass
    return vec


def _calc_axis_averages(vec: np.ndarray) -> dict:
    """
    Calcula a média de respostas por eixo temático (eixos 1–7, 15 questões cada).
    Espelha calculateAxisAverages() em Dissonance.gs.
    """
    return {
        str(axis + 1): round(float(np.mean(vec[axis * _QUESTIONS_PER_AXIS:
                                               (axis + 1) * _QUESTIONS_PER_AXIS])), 4)
        for axis in range(7)
    }


def _calc_theoretical_value(vec: np.ndarray) -> float:
    """
    Valor A: média ponderada de todas as 105 respostas (escala 1–10).
    Espelha calculateWeightedAverage() em Dissonance.gs.
    """
    return float(np.mean(vec))


def _calc_practical_bias(fatos_master: list) -> float:
    """
    Valor B: bias prático normalizado para a escala 0–10.
    Usa userWeight (slider do usuário, 1–10) quando disponível;
    recai em weight intrínseco como fallback.
    Espelha calculateBiasScore() + normalização de processDissonance() em Dissonance.gs.

    Fórmula: raw_bias = abs(Σ pesos_ESQUERDA − Σ pesos_DIREITA)
             valor_B  = (raw_bias / (MAX_FACTS × SCALE_MAX)) × SCALE_MAX
    """
    peso_esquerda = 0.0
    peso_direita  = 0.0
    max_facts     = 10   # LIMITS.MAX_FACTS_PER_TEST
    scale_max     = 10   # LIMITS.SCALE_MAX

    for fato in fatos_master:
        w   = float(fato.get("userWeight") or fato.get("weight", 5))
        ide = str(fato.get("ideology", "")).upper()
        if ide == "ESQUERDA":
            peso_esquerda += w
        elif ide == "DIREITA":
            peso_direita  += w
        # NEUTRO: não entra na equação de viés ideológico

    raw_bias     = abs(peso_esquerda - peso_direita)
    max_possible = max_facts * scale_max
    return round((raw_bias / max_possible) * scale_max, 4) if max_possible > 0 else 0.0


def _calc_dissonance(theoretical: float, practical: float) -> dict:
    """
    Calcula dissonância ideológica e sua severidade.
    Espelha calculateIdeologicalDissonance() em Dissonance.gs.

    Fórmula: coeficiente = abs(Valor_A − Valor_B)
    """
    coefficient = abs(theoretical - practical)

    if coefficient < 2:
        severity    = "BAIXA"
        description = "Alta coerência entre convicções teóricas e análise prática."
    elif coefficient < 4:
        severity    = "MODERADA"
        description = "Dissonância moderada: possível viés inconsciente."
    elif coefficient < 6:
        severity    = "ELEVADA"
        description = "Dissonância significativa: indícios de parcialidade seletiva."
    else:
        severity    = "CRÍTICA"
        description = "Contradição fundamental entre posição teórica e análise prática dos fatos."

    return {
        "coefficient": round(coefficient, 4),
        "severity":    severity,
        "description": description,
    }


def _calc_coherence(vec_scaled: np.ndarray, cluster_idx: int) -> float:
    """
    Coerência intra-cluster: distância euclidiana ao centroide transformada
    via kernel gaussiano normalizado → [0, 1].
    Quanto mais próximo do centroide, mais coerente o perfil.
    """
    centroid = _KMEANS.cluster_centers_[cluster_idx]
    dist     = float(np.linalg.norm(vec_scaled - centroid))
    return round(1.0 / (1.0 + dist), 4)

# ─── Flask App ────────────────────────────────────────────────────────────────

app = Flask(__name__)
CORS(app)  # Necessário para requisições originadas pelo Apps Script via UrlFetchApp


@app.route("/")
def home():
    return jsonify({
        "service":   "Quinto Poder — Microserviço de Auditoria Epistêmica",
        "version":   "2.0.0",
        "status":    "active",
        "endpoints": ["/health", "/analyze"],
    })


@app.route("/health")
def health():
    """
    Verificação de disponibilidade do serviço.
    Chamado por testColabEndpoint() em ColabIntegration.gs.
    Retorna HTTP 200 com {"status": "ok"} quando o servidor está operacional.
    """
    return jsonify({"status": "ok", "timestamp": time.time()})


@app.route("/analyze", methods=["POST"])
def analyze():
    """
    Análise psicométrica + ponderação epistêmica dos fatos do Banco Master.

    Payload esperado (enviado por executeColabAnalysis() em ColabIntegration.gs):
    {
      "perfil_data": {
        "answers": { "<titulo_exato_da_questao>": <valor 1-10>, ... }
      },
      "fatos_master": [
        { "id": "F1", "text": "...", "weight": 10, "ideology": "NEUTRO",
          "userWeight": 7 },
        ...
      ]
    }

    Resposta:
    {
      "status": "success",
      "analysis": {
        "cluster":            int (0–4),
        "profile_tag":        str,
        "coherence_score":    float [0, 1],
        "pca_coordinates":    [float, float],
        "axis_averages":      { "1": float, ..., "7": float },
        "theoretical_value":  float,
        "practical_bias":     float,
        "dissonance": {
          "coefficient": float,
          "severity":    "BAIXA" | "MODERADA" | "ELEVADA" | "CRÍTICA",
          "description": str
        }
      },
      "timestamp": float
    }
    """
    try:
        body = request.get_json(force=True, silent=True)
        if not body or not isinstance(body, dict):
            return jsonify({"status": "error", "message": "Payload JSON inválido."}), 400

        perfil_data  = body.get("perfil_data", {})
        fatos_master = body.get("fatos_master", [])

        if not isinstance(perfil_data, dict):
            return jsonify({"status": "error",
                            "message": "perfil_data deve ser um objeto JSON."}), 400

        answers = perfil_data.get("answers", {})
        if not isinstance(answers, dict):
            return jsonify({"status": "error",
                            "message": "perfil_data.answers deve ser um objeto JSON."}), 400

        if not isinstance(fatos_master, list):
            fatos_master = []

        # 1. Constrói vetor de 105 respostas ordenadas por questão canônica
        vec        = _build_answer_vector(answers)
        vec_scaled = _SCALER.transform([vec])[0]

        # 2. Perfil ideológico via K-Means
        cluster     = int(_KMEANS.predict([vec_scaled])[0])
        profile_tag = PROFILE_NAMES[cluster]
        coherence   = _calc_coherence(vec_scaled, cluster)

        # 3. Projeção 2D via PCA (para visualização no Dashboard)
        pca_coords = _PCA.transform([vec_scaled])[0].tolist()

        # 4. Médias por eixo temático (espelha calculateAxisAverages em Dissonance.gs)
        axis_avgs = _calc_axis_averages(vec)

        # 5. Pipeline de dissonância ideológica (espelha processDissonance em Dissonance.gs)
        theoretical = _calc_theoretical_value(vec)
        practical   = _calc_practical_bias(fatos_master)
        dissonance  = _calc_dissonance(theoretical, practical)

        result = {
            "status": "success",
            "analysis": {
                "cluster":           cluster,
                "profile_tag":       profile_tag,
                "coherence_score":   coherence,
                "pca_coordinates":   pca_coords,
                "axis_averages":     axis_avgs,
                "theoretical_value": round(theoretical, 4),
                "practical_bias":    round(practical, 4),
                "dissonance":        dissonance,
            },
            "timestamp": time.time(),
        }

        return jsonify(result)

    except Exception as exc:
        return jsonify({"status": "error", "message": str(exc)}), 500

# ─── Inicialização do Servidor ────────────────────────────────────────────────

def run_server(port: int = 5000):
    """
    Configura o authtoken do ngrok (se disponível), abre o tunnel público
    e inicia o Flask em thread daemon para não bloquear a célula do Colab.

    Fontes do authtoken (em ordem de prioridade):
      1. Variável de ambiente NGROK_AUTHTOKEN
      2. Colab Secrets (google.colab.userdata) — chave "NGROK_AUTHTOKEN"
    """
    authtoken = os.environ.get("NGROK_AUTHTOKEN", "")
    if not authtoken:
        try:
            from google.colab import userdata  # type: ignore
            authtoken = userdata.get("NGROK_AUTHTOKEN") or ""
        except Exception:
            pass

    if authtoken:
        ngrok.set_auth_token(authtoken)
        print("[ngrok] Authtoken configurado.")
    else:
        print("[ngrok] Sem authtoken — usando sessão anônima (limite de 1 túnel simultâneo).")

    tunnel     = ngrok.connect(port)
    # Compatível com pyngrok ≥ 5 (NgrokTunnel) e versões anteriores (string)
    public_url = tunnel.public_url if hasattr(tunnel, "public_url") else str(tunnel)

    print()
    print("=" * 62)
    print(f"  URL Pública : {public_url}")
    print(f"  Configure no GAS → Properties.gs → COLAB_URL = '{public_url}'")
    print("=" * 62)
    print()

    # Thread daemon: Flask continua rodando após a célula do Colab retornar
    flask_thread = threading.Thread(
        target=lambda: app.run(port=port, use_reloader=False, threaded=True),
        daemon=True,
    )
    flask_thread.start()
    print(f"Servidor Flask ativo na porta {port}. Pressione Interromper (■) para encerrar.")


run_server()
