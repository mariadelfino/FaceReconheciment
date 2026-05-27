"use strict";

const App = (() => {

  const LOG_PAGE_HTML = `
    <div class="log-page">
      <header class="page-header">
        <div class="logo">
          <img src="img/logo.svg" alt="FaceScan" class="logo-img" />
        </div>
        <div class="page-header-copy">
          <div class="page-header-title">LOG DO SISTEMA</div>
          <div class="page-header-subtitle">Acompanhe eventos, status e execucoes em tempo real</div>
        </div>
        <div class="page-header-badge">FACE_SCAN</div>
      </header>

      <div class="app-shell">
        <div data-sidebar data-sidebar-active="log"></div>

        <main class="app-content log-content">
          <div class="settings-hero">
            <h1>Eventos do sistema</h1>
            <p>
              Esta pagina concentra os registros gerados durante a execucao do scanner e das integracoes.
            </p>
          </div>

          <div class="settings-grid log-grid">
            <div class="setup-card settings-card log-card">
              <div class="card-title"><i class="bi bi-journal-text" aria-hidden="true"></i> LOG DO SISTEMA</div>
              <div class="log-area log-page-area" id="log-page-area">
                <div class="log-line">
                  <span class="log-time">[INIT]</span>
                  <span class="log-text ok">Sistema carregado</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>`;

  const state = {
    geminiKey: "",
    azureFaceKey: "", azureFaceEndpoint: "",
    faceCheckKey: "",
    videoStream: null, faceDetector: null,
    detectionCount: 0, analysisCount: 0,
    lastCapture: null,
    setupMode: "startup",
    logEntries: [],
    analysisHistory: [],
  };

  const HISTORY_STORAGE_KEY = "facescan-analysis-history";
  const LOCAL_DB_STORAGE_KEY = "facescan-local-db";
  const AZURE_PERSON_GROUP_ID = "facescan-localdb";

  /* ── History ──────────────────────────────────────────────── */
  function loadHistoryEntries() {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function saveHistoryEntries(entries) {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries.slice(0, 20)));
    } catch (_) {}
  }

  function persistAnalysisHistory(entry) {
    const nextEntry = {
      id: (window.crypto && typeof window.crypto.randomUUID === "function")
        ? window.crypto.randomUUID()
        : String(Date.now()),
      timestamp: new Date().toISOString(),
      imageData: entry.imageData || "",
      data: entry.data || null,
      azure: entry.azure || null,
      faceItems: entry.faceItems || [],
    };

    state.analysisHistory = [nextEntry, ...state.analysisHistory].slice(0, 20);
    saveHistoryEntries(state.analysisHistory);
    return nextEntry;
  }

  /* ── Local DB ─────────────────────────────────────────────── */
  function loadLocalDB() {
    try {
      const raw = localStorage.getItem(LOCAL_DB_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
  }

  function saveLocalDB(persons) {
    try { localStorage.setItem(LOCAL_DB_STORAGE_KEY, JSON.stringify(persons)); } catch (_) {}
  }

  function getLocalDBPersonById(azurePersonId) {
    return loadLocalDB().find(p => p.azurePersonId === azurePersonId) || null;
  }

  /* ── Helpers ──────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);
  const setText = (id, value) => {
    const el = $(id);
    if (el) el.textContent = value;
  };
  const setHtml = (id, value) => {
    const el = $(id);
    if (el) el.innerHTML = value;
  };
  const setButtonState = (id, iconClass, label) => {
    const el = $(id);
    if (el) el.innerHTML = `<i class="${iconClass}" aria-hidden="true"></i> ${label}`;
  };

  /* ── Init ─────────────────────────────────────────────────── */
  async function init() {
    const btn = $("start-btn");
    btn.disabled = true;
    setButtonState("start-btn", "bi bi-hourglass-split", "CONECTANDO...");
    hideError();

    state.geminiKey         = ENV.GEMINI_API_KEY      || "";
    state.azureFaceKey      = ENV.AZURE_FACE_KEY      || "";
    state.azureFaceEndpoint = ENV.AZURE_FACE_ENDPOINT || "";
    state.faceCheckKey      = ENV.FACECHECK_API_KEY   || "";

    try { await testGeminiKey(); }
    catch (err) {
      showError("Falha na conexão com Gemini: " + err.message);
      btn.disabled = false; setButtonState("start-btn", "bi bi-play-circle", "INICIAR SISTEMA"); return;
    }
    setDot("api-dot", true);
    setText("api-status-text", "GEMINI + GOOGLE SEARCH ONLINE");

    if (state.azureFaceKey && state.azureFaceKey !== "SUA_CHAVE_AZURE_AQUI") {
      try {
        await testAzureKey();
        setDot("azure-dot", true);
        setText("azure-status-text", "AZURE FACE ONLINE");
        log("Azure Face API conectado", "ok");
      } catch (err) {
        setDot("azure-dot", false);
        setText("azure-status-text", "AZURE FACE ERRO");
        log("Azure: " + err.message, "warn");
      }
    }

    if (state.faceCheckKey && state.faceCheckKey !== "SUA_CHAVE_FACECHECK_AQUI") {
      setDot("facecheck-dot", true);
      setText("facecheck-status-text", "FACECHECK ONLINE");
      log("FaceCheck.ID configurado — busca reversa ativa", "ok");
    }

    try { await startCamera(); }
    catch (err) {
      showError("Erro ao acessar câmera: " + err.message);
      btn.disabled = false; setButtonState("start-btn", "bi bi-play-circle", "INICIAR SISTEMA"); return;
    }

    state.setupMode = "main";
    $("setup-screen").style.display = "none";
    $("app-screen").style.display   = "block";
    initFaceDetection();
    log("Sistema totalmente operacional", "ok");
  }

  function openLogPage() {
    state.setupMode = "log";
    if (window.LogDoSistemaPage && typeof window.LogDoSistemaPage.open === "function") {
      window.LogDoSistemaPage.open();
      return;
    }

    const logScreen = $("log-screen");
    if (!logScreen) return;
    logScreen.innerHTML = LOG_PAGE_HTML;
    if (window.SidebarComponent && typeof window.SidebarComponent.loadAll === "function") {
      window.SidebarComponent.loadAll(logScreen).catch(() => {});
    }
      logScreen.style.display = "block";
      const historyScreen = $("history-screen");
      if (historyScreen) historyScreen.style.display = "none";
    $("app-screen").style.display = "none";
    renderLogArea(logScreen);
  }

  function openMainPage() {
    const historyScreen = $("history-screen");
    if (historyScreen) historyScreen.style.display = "none";
    const logScreen = $("log-screen");
    if (logScreen) logScreen.style.display = "none";
      if (window.HistoricoPage && typeof window.HistoricoPage.closeModal === "function") {
        window.HistoricoPage.closeModal();
      }
      document.body.classList.remove("modal-open");
    $("app-screen").style.display = "block";
    state.setupMode = "main";
  }

  function openHistoryPage() {
    state.setupMode = "history";
    if (window.HistoricoPage && typeof window.HistoricoPage.open === "function") {
      window.HistoricoPage.open();
      return;
    }

    const historyScreen = $("history-screen");
    if (!historyScreen) return;
    historyScreen.style.display = "block";
    $("app-screen").style.display = "none";
    const logScreen = $("log-screen");
    if (logScreen) logScreen.style.display = "none";
  }

  /* ── Câmera ───────────────────────────────────────────────── */
  async function startCamera() {
    state.videoStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
    });
    const video = $("video");
    video.srcObject = state.videoStream;
    await new Promise(r => (video.onloadedmetadata = r));

    setDot("cam-dot", true);
    setText("cam-status-text", "CÂMERA ONLINE");
    setHtml("cam-status-overlay", '<i class="bi bi-broadcast" aria-hidden="true"></i> AO VIVO — DETECTANDO ROSTOS');

    const canvas = $("canvas-overlay");
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    log("Câmera iniciada: " + video.videoWidth + "×" + video.videoHeight, "ok");
  }

  /* ── Detecção facial ──────────────────────────────────────── */
  function initFaceDetection() {
    if ("FaceDetector" in window) {
      state.faceDetector = new FaceDetector({ fastMode: false, maxDetectedFaces: 5 });
      log("FaceDetector API nativo ativado", "ok");
      runDetectionLoop();
    } else {
      log("FaceDetector API indisponível (use Chrome)", "warn");
      runFallbackOverlay();
    }
  }

  function runDetectionLoop() {
    const video = $("video"), canvas = $("canvas-overlay"), ctx = canvas.getContext("2d");
    const tick = async () => {
      if (!state.faceDetector || !video.videoWidth) { requestAnimationFrame(tick); return; }
      try {
        const faces = await state.faceDetector.detect(video);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        $("face-badge").style.display  = "block";
        $("face-badge").textContent    = faces.length + " ROSTO(S)";
        $("stat-faces").textContent    = faces.length;
        if (faces.length > 0) {
          state.detectionCount++;
          $("stat-detections").textContent    = state.detectionCount;
          $("scan-btn").disabled              = false;
          setHtml("cam-status-overlay", '<i class="bi bi-broadcast" aria-hidden="true"></i> ' + faces.length + ' ROSTO(S) DETECTADO(S)');
          faces.forEach((f, i) => {
            const b = f.boundingBox;
            drawFaceBox(ctx, b.x, b.y, b.width, b.height, "ID-" + String(i+1).padStart(3,"0"), 1.0);
          });
        } else {
          $("scan-btn").disabled              = true;
          setHtml("cam-status-overlay", '<i class="bi bi-broadcast" aria-hidden="true"></i> AO VIVO — AGUARDANDO ROSTO');
        }
      } catch(_) {}
      requestAnimationFrame(tick);
    };
    tick();
  }

  function runFallbackOverlay() {
    const canvas = $("canvas-overlay"), ctx = canvas.getContext("2d");
    setInterval(() => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const fw = canvas.width * 0.4, fh = canvas.height * 0.55;
      drawFaceBox(ctx, canvas.width/2 - fw/2, canvas.height/2 - fh/2, fw, fh, "POSICIONE O ROSTO", 0.4);
    }, 100);
    $("face-badge").style.display  = "block";
    $("face-badge").textContent    = "INSIRA O ROSTO";
    $("scan-btn").disabled         = false;
    setHtml("cam-status-overlay", '<i class="bi bi-broadcast" aria-hidden="true"></i> AO VIVO — CLIQUE EM ESCANEAR');
  }

  function drawFaceBox(ctx, x, y, w, h, label, alpha) {
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 333);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = `rgba(0,245,255,${0.7 + 0.3 * pulse})`;
    ctx.lineWidth = 1.5; ctx.setLineDash([8,4]);
    ctx.strokeRect(x, y, w, h); ctx.setLineDash([]);
    const cs = 20;
    ctx.strokeStyle = `rgba(0,255,136,${0.9 + 0.1 * pulse})`; ctx.lineWidth = 2.5;
    [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]].forEach(([px,py,dx,dy]) => {
      ctx.beginPath(); ctx.moveTo(px+dx*cs,py); ctx.lineTo(px,py); ctx.lineTo(px,py+dy*cs); ctx.stroke();
    });
    const cx = x+w/2, cy = y+h/2;
    ctx.strokeStyle = `rgba(0,245,255,${0.3*pulse})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx-15,cy); ctx.lineTo(cx+15,cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx,cy-15); ctx.lineTo(cx,cy+15); ctx.stroke();
    ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(x, y-22, 120, 20);
    ctx.fillStyle = "rgba(0,245,255,0.9)"; ctx.font = '11px "Share Tech Mono", monospace';
    ctx.fillText(label, x+6, y-7);
    ctx.restore();
  }

  /* ── Scan ─────────────────────────────────────────────────── */
  async function scanFace() {
    const video = $("video");
    if (!video.videoWidth) { log("Câmera não disponível", "err"); return; }

    $("stat-status").textContent = "SCAN...";
    $("scan-btn").disabled = true;

    const capture = $("capture-canvas");
    capture.width = video.videoWidth; capture.height = video.videoHeight;
    const ctx = capture.getContext("2d");
    ctx.save(); ctx.scale(-1,1); ctx.drawImage(video, -capture.width, 0); ctx.restore();

    const imageData = capture.toDataURL("image/jpeg", 0.85);
    state.lastCapture = imageData;

    $("target-preview").src           = imageData;
    $("target-preview").style.display = "block";
    $("no-target-msg").style.display  = "none";

    showLoading();
    log("Frame capturado — iniciando análise completa", "ok");

    const b64 = imageData.split(",")[1];
    setLoadingStep(1); await delay(200);
    setLoadingStep(2);

    try {
      const [faceCheckRes, azureRes] = await Promise.allSettled([
        searchWithFaceCheck(b64),
        analyzeWithAzure(b64),
      ]);

      const faceItems = faceCheckRes.status === "fulfilled" ? faceCheckRes.value : null;
      const azure     = azureRes.status     === "fulfilled" ? azureRes.value     : null;

      if (faceItems && faceItems.length > 0)
        log("FaceCheck: " + faceItems.length + " correspondência(s) encontrada(s)", "ok");
      if (azure)
        log("Azure: biometria real obtida", "ok");

      // Tenta identificar no banco local antes do Gemini (usa Gemini Vision para comparar rostos)
      let localMatch = null;
      if (loadLocalDB().length > 0) {
        try {
          localMatch = await identifyFromLocalDB(b64);
          if (localMatch) log("Banco local: " + localMatch.name + " reconhecido!", "ok");
        } catch (_) {}
      }

      setLoadingStep(3);
      log("Gemini pesquisando no Google...", "ok");

      const geminiResult = await analyzeWithGeminiSearch(b64, faceItems, localMatch);

      setLoadingStep(4); await delay(200);
      setLoadingStep(5); await delay(200);

      state.analysisCount++;
      $("stat-analyses").textContent = state.analysisCount;
      renderPopup(geminiResult, azure, faceItems, imageData, localMatch);
      log("Análise concluída com sucesso", "ok");

    } catch (err) {
      hideLoading();
      log("Erro na análise: " + err.message, "err");
      renderErrorPopup(err.message);
    }

    $("scan-btn").disabled       = false;
    $("stat-status").textContent = "PRONTO";
  }

  /* ── Google Gemini API + Search Grounding ─────────────────── */
  async function testGeminiKey() {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${state.geminiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: "OK" }] }],
        generationConfig: { maxOutputTokens: 5 },
      }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e?.error?.message || "HTTP " + res.status);
    }
  }

  async function analyzeWithGeminiSearch(base64, faceItems, localMatch = null) {
    let webContext = "";
    if (faceItems && faceItems.length > 0) {
      const top = faceItems.slice(0, 5);
      webContext = `\n\nO rosto foi encontrado nas seguintes páginas da internet:\n` +
        top.map(item => `- ${item.url} (relevância: ${item.score}%)`).join("\n") +
        `\n\nUse essas URLs junto com sua busca no Google para confirmar a identidade com máxima precisão.`;
    }

    let localContext = "";
    if (localMatch) {
      localContext = `\n\nIMPORTANTE — BANCO DE DADOS LOCAL: Esta pessoa foi cadastrada localmente com o nome "${localMatch.name}" (${localMatch.age} anos). Busque especificamente por "${localMatch.name}" para confirmar e enriquecer o perfil.`;
    }

    const prompt = `Você é um sistema especializado em identificação de pessoas públicas e análise OSINT (Open Source Intelligence).

OBJETIVO: Identificar com máxima precisão quem é a pessoa nesta imagem usando Google Search.

═══ ETAPA 1 — ANÁLISE VISUAL (obrigatória antes de buscar) ═══
Observe atentamente e anote:
- Gênero, faixa etária estimada (±5 anos), etnia/origem aparente
- Cabelo: cor, comprimento, textura, estilo (liso, crespo, ondulado, raspado, tingido, etc.)
- Formato do rosto, sobrancelhas, olhos, nariz, lábios — traços marcantes
- Tom de pele, marcas visíveis, tatuagens, piercings, cicatrizes
- Barba/bigode: presença, estilo e tamanho
- Óculos ou lentes: tipo se houver
- Contexto: roupa, uniforme, acessórios, fundo — qualquer pista sobre profissão, país ou época

═══ ETAPA 2 — BUSCA NO GOOGLE (use múltiplas estratégias) ═══
Tente estas buscas em sequência até identificar:
1. Celebridade brasileira com as características físicas observadas
2. "ator/atriz brasileiro/a" + cor de cabelo + etnia
3. "cantor/cantora" + estilo musical aparente + características
4. "atleta famoso" + esporte visível ou características físicas
5. "apresentador TV" + emissora visível (Globo, SBT, Record, Band, etc.)
6. "político brasileiro" + cargo ou características
7. "influencer/youtuber" + nicho aparente
8. Para internacionais: busque em inglês "famous [actor/singer/athlete]" + características
9. Consulte: Wikipedia em PT e EN, IMDb, Globo.com, G1, UOL, Folha, ESPN Brasil
10. Se não achar na 1ª busca, tente combinações diferentes — NÃO desista

═══ ETAPA 3 — CONFIRMAÇÃO ═══
Após identificar um candidato, busque pelo nome completo para confirmar com múltiplas fontes antes de aumentar a confiança.

ESCALA DE CONFIANÇA:
- "Alta" (>85%): Certeza — múltiplas fontes confirmam a mesma pessoa
- "Média" (55–85%): Provável — ao menos uma fonte indica claramente
- "Baixa" (<55%): Incerto, suspeita sem confirmação ou pessoa não identificada

RETORNE APENAS JSON VÁLIDO SEM MARKDOWN:

{
  "web_info": {
    "identified": true,
    "confidence": "Alta",
    "confidence_pct": 90,
    "name": "Nome completo ou DESCONHECIDO",
    "occupation": "Profissão",
    "nationality": "Nacionalidade",
    "born": "Data de nascimento ou faixa etária estimada",
    "known_for": "Principal motivo de notoriedade ou traço marcante",
    "summary": "Biografia detalhada com base nos dados encontrados na internet via Google Search",
    "tags": ["tag1", "tag2", "tag3"]
  },
  "status": {
    "humor": "Estado emocional aparente",
    "expressao": "Descrição da expressão facial",
    "caracteristicas": "Traços físicos visíveis",
    "ambiente": "Descrição do ambiente ao fundo",
    "iluminacao": "Tipo e qualidade da iluminação",
    "postura": "Postura e enquadramento",
    "tags": ["tag1", "tag2", "tag3"]
  }
}${webContext}${localContext}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${state.geminiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: "image/jpeg", data: base64 } },
          ],
        }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 3000 },
      }),
    });

    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e?.error?.message || "Gemini HTTP " + res.status);
    }

    const data = await res.json();
    const candidate = data.candidates?.[0];
    const rawText = (candidate?.content?.parts || []).map(p => p.text || "").join("");

    if (!rawText) throw new Error("Resposta vazia do Gemini");

    const groundingSources = (candidate?.groundingMetadata?.groundingChunks || [])
      .map(chunk => ({ url: chunk.web?.uri || "", title: chunk.web?.title || "" }))
      .filter(s => s.url);

    if (groundingSources.length > 0)
      log("Google Search: " + groundingSources.length + " fonte(s) encontrada(s)", "ok");

    const cleanText = rawText.replace(/\[\d+\]/g, "").replace(/```json|```/g, "");
    const match = cleanText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Formato de resposta inválido");

    let parsed;
    try {
      parsed = JSON.parse(match[0]);
    } catch (_) {
      // Resposta truncada (MAX_TOKENS) — tenta reparar fechando chaves abertas
      let txt = match[0];
      const opens  = (txt.match(/\{/g) || []).length;
      const closes = (txt.match(/\}/g) || []).length;
      txt += "}".repeat(Math.max(0, opens - closes));
      parsed = JSON.parse(txt);
    }
    parsed._geminiSources = groundingSources;
    return parsed;
  }

  /* ── FaceCheck.ID ─────────────────────────────────────────── */
  async function searchWithFaceCheck(base64) {
    if (!state.faceCheckKey || state.faceCheckKey === "SUA_CHAVE_FACECHECK_AQUI") return null;

    const byteStr = atob(base64);
    const bytes   = new Uint8Array(byteStr.length);
    for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
    const blob = new Blob([bytes], { type: "image/jpeg" });

    const formData = new FormData();
    formData.append("images", blob, "face.jpg");
    formData.append("id_search", "");

    const uploadRes = await fetch("https://facecheck.id/api/upload_pic", {
      method: "POST",
      headers: { "x-facecheck-api-key": state.faceCheckKey },
      body: formData,
    });
    const uploadData = await uploadRes.json();
    if (uploadData.error) throw new Error(uploadData.error);

    const idSearch = uploadData.id_search;
    if (!idSearch) throw new Error("id_search não retornado");

    for (let i = 0; i < 30; i++) {
      await delay(3000);
      const searchRes = await fetch("https://facecheck.id/api/search", {
        method: "POST",
        headers: { "x-facecheck-api-key": state.faceCheckKey, "Content-Type": "application/json" },
        body: JSON.stringify({ id_search: idSearch, with_progress: true }),
      });
      const searchData = await searchRes.json();
      if (searchData.error) throw new Error(searchData.error);
      if (searchData.output) return searchData.output.items || [];
      if (searchData.progress !== undefined)
        log("FaceCheck: buscando... " + searchData.progress + "%", "ok");
    }
    throw new Error("timeout");
  }

  /* ── Azure Face API ───────────────────────────────────────── */
  async function testAzureKey() {
    const canvas = document.createElement("canvas");
    canvas.width = 10; canvas.height = 10;
    canvas.getContext("2d").fillRect(0, 0, 10, 10);
    const blob = await new Promise(r => canvas.toBlob(r, "image/jpeg", 0.5));
    const res = await fetch(
      state.azureFaceEndpoint.replace(/\/$/, "") + "/face/v1.0/detect?detectionModel=detection_01",
      { method: "POST", headers: { "Content-Type": "application/octet-stream", "Ocp-Apim-Subscription-Key": state.azureFaceKey }, body: blob }
    );
    if (res.status === 401 || res.status === 403) {
      const e = await res.json().catch(() => ({}));
      const msg = e?.error?.innererror?.message || e?.error?.message || "HTTP " + res.status;
      if (msg.includes("UnsupportedFeature") || msg.includes("deprecated")) return;
      throw new Error(msg);
    }
  }

  async function analyzeWithAzure(base64) {
    if (!state.azureFaceKey || !state.azureFaceEndpoint ||
        state.azureFaceKey === "SUA_CHAVE_AZURE_AQUI") return null;

    const byteStr = atob(base64);
    const bytes   = new Uint8Array(byteStr.length);
    for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
    const blob = new Blob([bytes], { type: "image/jpeg" });

    // qualityForRecognition exige recognition_03/04; emotion/age/gender/smile/hair descontinuados
    const url = state.azureFaceEndpoint.replace(/\/$/, "") +
      "/face/v1.0/detect?returnFaceAttributes=headPose&detectionModel=detection_01";

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "Ocp-Apim-Subscription-Key": state.azureFaceKey },
      body: blob,
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e?.error?.message || "HTTP " + res.status);
    }
    const faces = await res.json();
    if (faces.length === 0) return null;
    // Inclui faceId para identificação no banco local
    const attrs = Object.assign({}, faces[0].faceAttributes || {});
    attrs._faceId = faces[0].faceId;
    return attrs;
  }

  /* ── Azure PersonGroup (banco local) ─────────────────────── */
  async function ensurePersonGroupExists() {
    const base = state.azureFaceEndpoint.replace(/\/$/, "");
    const url = `${base}/face/v1.0/persongroups/${AZURE_PERSON_GROUP_ID}`;
    const getRes = await fetch(url, {
      method: "GET",
      headers: { "Ocp-Apim-Subscription-Key": state.azureFaceKey },
    });
    if (getRes.status === 404) {
      const createRes = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "Ocp-Apim-Subscription-Key": state.azureFaceKey },
        body: JSON.stringify({ name: "FaceScan Local DB", userData: "" }),
      });
      if (!createRes.ok) {
        const e = await createRes.json().catch(() => ({}));
        throw new Error(e?.error?.message || "Falha ao criar PersonGroup");
      }
      log("PersonGroup criado no Azure", "ok");
    }
  }

  async function registerPersonToAzure(name, base64) {
    const base = state.azureFaceEndpoint.replace(/\/$/, "");

    await ensurePersonGroupExists();

    const createRes = await fetch(
      `${base}/face/v1.0/persongroups/${AZURE_PERSON_GROUP_ID}/persons`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "Ocp-Apim-Subscription-Key": state.azureFaceKey },
        body: JSON.stringify({ name }),
      }
    );
    if (!createRes.ok) {
      const e = await createRes.json().catch(() => ({}));
      throw new Error(e?.error?.message || "Falha ao criar pessoa no Azure");
    }
    const { personId } = await createRes.json();

    const byteStr = atob(base64);
    const bytes = new Uint8Array(byteStr.length);
    for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
    const blob = new Blob([bytes], { type: "image/jpeg" });

    const addFaceRes = await fetch(
      `${base}/face/v1.0/persongroups/${AZURE_PERSON_GROUP_ID}/persons/${personId}/persistedFaces`,
      {
        method: "POST",
        headers: { "Content-Type": "application/octet-stream", "Ocp-Apim-Subscription-Key": state.azureFaceKey },
        body: blob,
      }
    );
    if (!addFaceRes.ok) {
      const e = await addFaceRes.json().catch(() => ({}));
      throw new Error(e?.error?.message || "Falha ao adicionar rosto");
    }

    // Treina o grupo em background
    fetch(
      `${base}/face/v1.0/persongroups/${AZURE_PERSON_GROUP_ID}/train`,
      { method: "POST", headers: { "Ocp-Apim-Subscription-Key": state.azureFaceKey } }
    ).then(() => log("Azure PersonGroup: treinamento iniciado", "ok")).catch(() => {});

    return personId;
  }

  // Compara rosto atual com banco local usando Gemini Vision (independente do Azure)
  async function identifyFromLocalDB(currentB64) {
    const db = loadLocalDB();
    if (db.length === 0) return null;
    if (!state.geminiKey) return null;

    log("Comparando rosto com banco local (" + db.length + " cadastro(s))...", "ok");

    for (const person of db) {
      if (!person.imageData) continue;
      try {
        const storedB64 = person.imageData.split(",")[1];
        if (!storedB64) continue;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${state.geminiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: 'Compare as duas fotos de rosto. A primeira é o alvo atual, a segunda é do banco de dados. São a MESMA pessoa? Responda SOMENTE com JSON sem markdown: {"same":true,"confidence":85}' },
                { inline_data: { mime_type: "image/jpeg", data: currentB64 } },
                { inline_data: { mime_type: "image/jpeg", data: storedB64 } },
              ],
            }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 256, thinkingConfig: { thinkingBudget: 0 } },
          }),
        });

        if (!res.ok) continue;
        const data = await res.json();
        const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("");
        const m = text.match(/\{[\s\S]*?\}/);
        if (!m) continue;

        const result = JSON.parse(m[0]);
        const conf = result.confidence ?? 0;
        log("Banco local — " + person.name + ": " + (result.same ? "MESMA PESSOA" : "diferente") + " (" + conf + "%)", result.same ? "ok" : "");

        if (result.same && conf >= 70) {
          return { ...person, matchConfidence: conf / 100 };
        }
      } catch (_) { continue; }
    }

    return null;
  }

  function getTopEmotion(emotions) {
    if (!emotions) return "—";
    const map = { anger:"Raiva", contempt:"Desprezo", disgust:"Nojo", fear:"Medo",
                  happiness:"Felicidade", neutral:"Neutro", sadness:"Tristeza", surprise:"Surpresa" };
    const [key, val] = Object.entries(emotions).sort((a,b) => b[1]-a[1])[0];
    return (map[key] || key) + " (" + Math.round(val * 100) + "%)";
  }

  function getHairDescription(hair) {
    if (!hair) return "—";
    if (hair.invisible) return "Não visível";
    if (hair.bald > 0.7) return "Calvo";
    const colorMap = { black:"Preto", blond:"Loiro", brown:"Castanho", gray:"Grisalho", red:"Ruivo", white:"Branco", other:"Outro" };
    const topColor = (hair.hairColor || []).sort((a,b) => b.confidence-a.confidence)[0];
    return topColor ? (colorMap[topColor.color] || topColor.color) : "—";
  }

  function getFacialHairDesc(fh) {
    if (!fh) return "—";
    const parts = [];
    if (fh.beard     > 0.3) parts.push("Barba");
    if (fh.moustache > 0.3) parts.push("Bigode");
    if (fh.sideburns > 0.3) parts.push("Suíças");
    return parts.length > 0 ? parts.join(", ") : "Não detectado";
  }

  /* ── Popup ────────────────────────────────────────────────── */
  function renderPopup(data, azure, faceItems, imageData, localMatch = null) {
    hideLoading();
    const wi = data.web_info || {};
    const st = data.status   || {};
    const geminiSources = data._geminiSources || [];

    $("popup-photo").src = imageData;

    const pct = wi.confidence_pct || (wi.confidence === "Alta" ? 88 : wi.confidence === "Média" ? 60 : 35);
    $("conf-val").textContent = pct + "%";
    setTimeout(() => ($("conf-fill").style.width = pct + "%"), 100);

    setPopupMeta([
      wi.occupation || "—",
      wi.nationality || "—",
      wi.born || "—",
    ]);

    $("popup-name").textContent    = wi.name    || "Desconhecido";
    $("popup-summary").textContent = wi.summary || "—";

    // Banner de match no banco local
    const localMatchEl = $("popup-local-match");
    if (localMatchEl) {
      if (localMatch) {
        const confPct = Math.round((localMatch.matchConfidence || 0) * 100);
        localMatchEl.style.display = "flex";
        localMatchEl.innerHTML = `
          <i class="bi bi-database-check" aria-hidden="true"></i>
          <span><strong>BANCO LOCAL:</strong> ${escHtml(localMatch.name)}, ${localMatch.age} anos</span>
          <span class="tag green" style="margin-left:auto">${confPct}% CONF.</span>`;
      } else {
        localMatchEl.style.display = "none";
      }
    }

    const wiTags = $("popup-tags");
    wiTags.innerHTML = "";
    const tags1 = [...(wi.tags || [])];
    if (wi.confidence) tags1.unshift(wi.confidence + " CONF.");
    if (geminiSources.length > 0) tags1.push("GOOGLE SEARCH");
    if (faceItems && faceItems.length > 0) tags1.push("WEB MATCH");
    if (localMatch) tags1.push("BANCO LOCAL");
    tags1.slice(0,6).forEach((t, i) => {
      const cls = i===0 ? (wi.confidence==="Alta"?"green":wi.confidence==="Baixa"?"red":"yellow") : "";
      wiTags.innerHTML += `<span class="tag ${cls}">${escHtml(t)}</span>`;
    });

    const wiGrid = $("popup-info-grid");
    wiGrid.innerHTML = "";
    [
      { label:"IDENTIFICADO", value: wi.identified ? "SIM" : "NÃO" },
      { label:"PROFISSÃO",    value: wi.occupation  || "—" },
      { label:"NACIONALIDADE",value: wi.nationality || "—" },
      { label:"NASCIMENTO",   value: wi.born        || "—" },
      { label:"CONHECIDO POR",value: wi.known_for   || "—" },
    ].forEach(dp => {
      wiGrid.innerHTML += `<div class="info-item"><div class="info-item-label">${escHtml(dp.label)}</div><div class="info-item-value">${escHtml(dp.value)}</div></div>`;
    });

    // Botão de cadastro — aparece somente quando não identificado e sem match local
    const registerSection = $("popup-register-section");
    if (registerSection) {
      const isUnknown = !wi.identified ||
        (wi.name || "").toLowerCase().replace(/\s/g,"").includes("desconhecid");
      registerSection.style.display = (isUnknown && !localMatch) ? "block" : "none";
    }

    // ── FONTES ──
    const allSources = [
      ...geminiSources.map(s => ({ url: s.url, title: s.title, score: null, type: "google" })),
      ...(faceItems || []).slice(0, 4).map(s => ({ url: s.url, title: "", score: s.score, type: "facecheck" })),
    ];

    const sourcesSection = $("sources-section");
    const sourcesList    = $("popup-sources");
    if (allSources.length > 0) {
      sourcesSection.style.display = "block";
      sourcesList.innerHTML = "";
      allSources.slice(0, 8).forEach(item => {
        let domain = "";
        try { domain = new URL(item.url).hostname.replace("www.", ""); } catch(_) { domain = item.url; }
        const badge = item.type === "google"
          ? `<div class="source-score" style="color:var(--cyan)">🔍</div>`
          : `<div class="source-score">${item.score}%</div>`;
        const label = item.title || domain;
        sourcesList.innerHTML += `
          <div class="source-item">
            ${badge}
            <div class="source-info">
              <div class="source-domain">${escHtml(label)}</div>
              <a class="source-url" href="${escHtml(item.url)}" target="_blank" rel="noopener">${escHtml(item.url)}</a>
            </div>
          </div>`;
      });
    } else {
      sourcesSection.style.display = "none";
    }

    // ── STATUS ──
    const stGrid = $("popup-status-grid");
    stGrid.innerHTML = "";
    [
      { label:"😄 HUMOR",           value: st.humor           || "—" },
      { label:"😐 EXPRESSÃO",       value: st.expressao       || "—" },
      { label:"👤 CARACTERÍSTICAS", value: st.caracteristicas || "—" },
      { label:"🏠 AMBIENTE",        value: st.ambiente        || "—" },
      { label:"💡 ILUMINAÇÃO",      value: st.iluminacao      || "—" },
      { label:"🧍 POSTURA",         value: st.postura         || "—" },
    ].forEach(dp => {
      stGrid.innerHTML += `<div class="info-item"><div class="info-item-label">${escHtml(dp.label)}</div><div class="info-item-value">${escHtml(dp.value)}</div></div>`;
    });

    const stTags = $("popup-status-tags");
    stTags.innerHTML = "";
    (st.tags || []).slice(0,6).forEach(t => {
      stTags.innerHTML += `<span class="tag yellow">${escHtml(t)}</span>`;
    });

    // ── AZURE BIOMETRIA (apenas campos não deprecados) ──
    const nichoAzure = $("nicho-azure");
    if (azure && azure.headPose) {
      nichoAzure.style.display = "block";
      const poseDesc = `Yaw ${azure.headPose.yaw.toFixed(0)}° / Pitch ${azure.headPose.pitch.toFixed(0)}° / Roll ${azure.headPose.roll.toFixed(0)}°`;
      const azGrid = $("popup-azure-grid");
      azGrid.innerHTML = "";
      [
        { label:"📐 POSE DA CABEÇA", value: poseDesc },
      ].forEach(dp => {
        azGrid.innerHTML += `<div class="info-item"><div class="info-item-label">${escHtml(dp.label)}</div><div class="info-item-value">${escHtml(dp.value)}</div></div>`;
      });
      const azTags = $("popup-azure-tags");
      azTags.innerHTML = '<span class="tag yellow">AZURE DETECT</span>';
    } else {
      nichoAzure.style.display = "none";
    }

    $("popup-timestamp").textContent = "ANÁLISE: " + new Date().toLocaleString("pt-BR");
    $("result-popup").classList.add("active");
    document.body.classList.add("modal-open");
    persistAnalysisHistory({ data, azure, faceItems, imageData });
  }

  function renderErrorPopup(msg) {
    hideLoading();
    $("popup-photo").src           = state.lastCapture || "";
    $("popup-name").textContent    = "ERRO NA ANÁLISE";
    $("popup-summary").textContent = "Verifique sua conexão e as chaves API, depois tente novamente.";
    $("popup-tags").innerHTML      = '<span class="tag red">FALHA</span>';
    $("popup-info-grid").innerHTML = "";
    $("nicho-azure").style.display = "none";
    $("sources-section").style.display = "none";
    $("conf-val").textContent = "0%"; $("conf-fill").style.width = "0%";
    setPopupMeta(["—"]);
    $("popup-timestamp").textContent = new Date().toLocaleString("pt-BR");
    const localMatchEl = $("popup-local-match");
    if (localMatchEl) localMatchEl.style.display = "none";
    const registerSection = $("popup-register-section");
    if (registerSection) registerSection.style.display = "none";
    $("result-popup").classList.add("active");
    document.body.classList.add("modal-open");
  }

  function closePopup() {
    $("result-popup").classList.remove("active");
    document.body.classList.remove("modal-open");
  }

  /* ── Modal de Cadastro ────────────────────────────────────── */
  function openRegisterModal() {
    const modal = $("register-modal");
    if (!modal) return;
    const photo = $("register-photo");
    if (photo) photo.src = state.lastCapture || "";
    const nameEl = $("register-name");
    const ageEl  = $("register-age");
    if (nameEl) nameEl.value = "";
    if (ageEl)  ageEl.value  = "";
    const errEl = $("register-error");
    const sucEl = $("register-success");
    if (errEl) errEl.style.display = "none";
    if (sucEl) sucEl.style.display = "none";
    const btn = $("register-submit-btn");
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="bi bi-person-check" aria-hidden="true"></i> CADASTRAR'; }
    modal.classList.add("active");
  }

  function closeRegisterModal() {
    const modal = $("register-modal");
    if (modal) modal.classList.remove("active");
  }

  async function submitRegister() {
    const name   = ($("register-name")?.value || "").trim();
    const ageVal = ($("register-age")?.value  || "").trim();
    const age    = parseInt(ageVal, 10);
    const errEl  = $("register-error");

    if (errEl) errEl.style.display = "none";

    if (!name) {
      if (errEl) { errEl.textContent = "Por favor, informe o nome completo."; errEl.style.display = "block"; }
      return;
    }
    if (!ageVal || isNaN(age) || age < 1 || age > 120) {
      if (errEl) { errEl.textContent = "Por favor, informe uma idade válida (1–120)."; errEl.style.display = "block"; }
      return;
    }

    const btn = $("register-submit-btn");
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="bi bi-hourglass-split" aria-hidden="true"></i> CADASTRANDO...'; }

    const b64 = state.lastCapture ? state.lastCapture.split(",")[1] : null;
    let azurePersonId = null;
    let azureRegistered = false;

    if (b64 && state.azureFaceKey && state.azureFaceKey !== "SUA_CHAVE_AZURE_AQUI") {
      try {
        azurePersonId = await registerPersonToAzure(name, b64);
        azureRegistered = true;
        log("Azure PersonGroup: " + name + " registrado com sucesso", "ok");
      } catch (err) {
        log("Azure PersonGroup indisponível (" + err.message + ") — usando verify direto no próximo scan", "warn");
      }
    }

    const db = loadLocalDB();
    db.push({
      id: (window.crypto?.randomUUID?.()) || String(Date.now()),
      azurePersonId: azurePersonId || null,
      name,
      age,
      imageData: state.lastCapture || "",
      registeredAt: new Date().toISOString(),
    });
    saveLocalDB(db);

    const sucEl = $("register-success");
    if (sucEl) {
      sucEl.style.display = "flex";
      sucEl.innerHTML = azureRegistered
        ? '<i class="bi bi-check-circle" aria-hidden="true"></i> Cadastrado com reconhecimento automático!'
        : '<i class="bi bi-check-circle" aria-hidden="true"></i> Cadastrado! Reconhecimento por comparação de rosto.';
    }
    if (btn) btn.innerHTML = '<i class="bi bi-check-circle" aria-hidden="true"></i> CADASTRADO!';
    log("Usuário cadastrado: " + name + ", " + age + " anos" + (azureRegistered ? " (Azure)" : " (local)"), "ok");

    setTimeout(() => closeRegisterModal(), 2000);
  }

  function setPopupMeta(items) {
    const meta = $("popup-meta");
    if (!meta) return;

    const lines = (items || []).filter(Boolean);
    if (lines.length === 0) {
      meta.innerHTML = `<div class="popup-meta-item">• —</div>`;
      return;
    }

    meta.innerHTML = lines.map(item => `<div class="popup-meta-item">• ${escHtml(item)}</div>`).join("");
  }

  /* ── Loading ──────────────────────────────────────────────── */
  const STEPS = [
    { icon: "bi-circle", doneIcon: "bi-check2", text: "Capturando frame..." },
    { icon: "bi-search", doneIcon: "bi-check2", text: "Buscando rosto na internet (FaceCheck)..." },
    { icon: "bi-google", doneIcon: "bi-check2", text: "Gemini pesquisando no Google..." },
    { icon: "bi-clipboard-data", doneIcon: "bi-check2", text: "Compilando dados..." },
    { icon: "bi-robot", doneIcon: "bi-check2", text: "Gerando perfil..." },
  ];

  function showLoading() { resetLoadingSteps(); $("loading-overlay").classList.add("active"); $("cam-wrapper").classList.add("scanning"); }
  function hideLoading() { $("loading-overlay").classList.remove("active"); $("cam-wrapper").classList.remove("scanning"); }

  function setLoadingStep(n) {
    for (let i = 1; i <= 5; i++) {
      const el = $("step" + i);
      el.className   = i < n ? "loading-step done" : i === n ? "loading-step active" : "loading-step";
      const step = STEPS[i - 1];
      const iconClass = i < n ? step.doneIcon : step.icon;
      el.innerHTML = `<i class="bi ${iconClass}" aria-hidden="true"></i> ${step.text}`;
    }
  }
  function resetLoadingSteps() { for (let i=1;i<=5;i++) { $("step"+i).className="loading-step"; $("step"+i).innerHTML=`<i class="bi ${STEPS[i-1].icon}" aria-hidden="true"></i> ${STEPS[i-1].text}`; } }

  /* ── Log ──────────────────────────────────────────────────── */
  function log(msg, type = "") {
    const time = new Date().toLocaleTimeString("pt-BR", {hour:"2-digit", minute:"2-digit", second:"2-digit"});

    state.logEntries.push({ time, msg, type });

    if (state.logEntries.length > 50) {
      state.logEntries.shift();
    }

    const areas = document.querySelectorAll(".log-area");
    areas.forEach(area => {
      const line = document.createElement("div");
      line.className = "log-line";
      line.innerHTML = `<span class="log-time">[${time}]</span><span class="log-text ${type}">${escHtml(msg)}</span>`;
      area.appendChild(line);
      area.scrollTop = area.scrollHeight;

      while (area.children.length > 50) {
        area.removeChild(area.firstChild);
      }
    });
  }

  function renderLogArea(root = document) {
    const areas = root.querySelectorAll(".log-area");
    if (areas.length === 0) return;

    areas.forEach(area => {
      let html = `<div class="log-line"><span class="log-time">[INIT]</span><span class="log-text ok">Sistema carregado</span></div>`;

      if (state.logEntries.length > 0) {
        html += state.logEntries.map(entry =>
          `<div class="log-line"><span class="log-time">[${entry.time}]</span><span class="log-text ${entry.type}">${escHtml(entry.msg)}</span></div>`
        ).join("");
      }

      area.innerHTML = html;
      area.scrollTop = area.scrollHeight;
    });
  }

  /* ── Reset ────────────────────────────────────────────────── */
  function resetSession() {
    $("target-preview").style.display = "none";
    $("no-target-msg").style.display  = "flex";
    $("stat-detections").textContent  = "0";
    $("stat-analyses").textContent    = "0";
    state.detectionCount = 0; state.analysisCount = 0;
    log("Sessão reiniciada", "warn");
  }

  /* ── Utils ────────────────────────────────────────────────── */
  function setDot(id, online) {
    const el = $(id);
    if (!el) return;
    el.style.background = online ? "var(--green)" : "var(--red)";
    el.style.boxShadow  = online ? "var(--glow-green)" : "0 0 8px var(--red)";
    el.classList.toggle("red", !online);
  }

  function showError(msg) { const el=$("key-error"); el.textContent="⚠ "+msg; el.style.display="block"; }
  function hideError()     { $("key-error").style.display="none"; }
  function escHtml(s)      { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  const delay = ms => new Promise(r => setTimeout(r, ms));

  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { closePopup(); closeRegisterModal(); }
    if (e.key === "Enter" && state.setupMode === "startup") init();
  });
  document.addEventListener("click", e => {
    const popup = $("result-popup");
    if (popup && e.target === popup) closePopup();
    const regModal = $("register-modal");
    if (regModal && e.target === regModal) closeRegisterModal();
  });

  state.analysisHistory = loadHistoryEntries();

  return {
    init, scanFace, resetSession, closePopup,
    openLogPage, openHistoryPage, openMainPage,
    renderLogArea, persistAnalysisHistory,
    openRegisterModal, closeRegisterModal, submitRegister,
  };

})();

