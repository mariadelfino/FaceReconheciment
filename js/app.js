"use strict";

const App = (() => {

  const state = {
    apiKey: "", model: "google/gemini-2.0-flash-exp:free",
    videoStream: null, faceDetector: null,
    detectionCount: 0, analysisCount: 0,
    lastCapture: null,
  };

  const $ = id => document.getElementById(id);

  /* ── Init ─────────────────────────────────────────────────── */
  async function init() {
    const btn = $("start-btn");
    btn.disabled = true;
    btn.textContent = "◉ CONECTANDO...";
    hideError();

    state.apiKey = ENV.OPENROUTER_API_KEY;
    state.model  = ENV.OPENROUTER_MODEL || "google/gemini-2.0-flash-exp:free";

    try { await testApiKey(); }
    catch (err) {
      showError("Falha na conexão com OpenRouter: " + err.message);
      btn.disabled = false; btn.textContent = "◈ INICIAR SISTEMA"; return;
    }

    setDot("api-dot", true);
    $("api-status-text").textContent = "OPENROUTER ONLINE";

    try { await startCamera(); }
    catch (err) {
      showError("Erro ao acessar câmera: " + err.message);
      btn.disabled = false; btn.textContent = "◈ INICIAR SISTEMA"; return;
    }

    $("setup-screen").style.display = "none";
    $("app-screen").style.display   = "block";
    initFaceDetection();
    log("Sistema totalmente operacional", "ok");
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
    $("cam-status-text").textContent    = "CÂMERA ONLINE";
    $("cam-status-overlay").textContent = "◉ AO VIVO — DETECTANDO ROSTOS";

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
          $("cam-status-overlay").textContent = "◉ " + faces.length + " ROSTO(S) DETECTADO(S)";
          faces.forEach((f, i) => {
            const b = f.boundingBox;
            drawFaceBox(ctx, b.x, b.y, b.width, b.height, "ID-" + String(i+1).padStart(3,"0"), 1.0);
          });
        } else {
          $("scan-btn").disabled              = true;
          $("cam-status-overlay").textContent = "◉ AO VIVO — AGUARDANDO ROSTO";
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
    $("face-badge").textContent    = "? ROSTOS";
    $("scan-btn").disabled         = false;
    $("cam-status-overlay").textContent = "◉ AO VIVO — CLIQUE EM ESCANEAR";
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
    ctx.fillText("◈ " + label, x+6, y-7);
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
    log("Frame capturado — enviando para análise", "ok");

    try {
      const result = await analyzeWithGemini(imageData.split(",")[1]);
      state.analysisCount++;
      $("stat-analyses").textContent = state.analysisCount;
      renderPopup(result, imageData);
      log("Análise concluída com sucesso", "ok");
    } catch (err) {
      hideLoading();
      log("Erro na análise: " + err.message, "err");
      renderErrorPopup(err.message);
    }

    $("scan-btn").disabled       = false;
    $("stat-status").textContent = "PRONTO";
  }

  /* ── OpenRouter API ───────────────────────────────────────── */
  async function analyzeWithGemini(base64) {
    setLoadingStep(1); await delay(300);
    setLoadingStep(2);

    const prompt = `Você é um sistema avançado de análise de identidade visual e comportamental.

Analise a imagem e retorne SOMENTE JSON válido, sem markdown, com exatamente esta estrutura:

{
  "web_info": {
    "identified": true,
    "confidence": "Alta",
    "confidence_pct": 85,
    "name": "Nome completo ou Desconhecido",
    "occupation": "Profissão ou traço",
    "nationality": "Nacionalidade ou traço",
    "born": "Data de nascimento ou estimativa ou traço",
    "known_for": "Motivo de notoriedade ou traço",
    "summary": "Breve biografia ou indicação de que não há dados públicos identificáveis",
    "tags": ["tag1", "tag2", "tag3"]
  },
  "status": {
    "humor": "Estado emocional aparente ex Calmo Cansado Animado Neutro Estressado",
    "expressao": "Descrição da expressão facial",
    "caracteristicas": "Traços físicos visíveis cabelo olhos pele idade estimada",
    "ambiente": "Ambiente ao fundo ex Quarto Escritório Área externa Fundo neutro",
    "iluminacao": "Tipo de iluminação ex Natural Artificial Baixa Boa iluminação",
    "postura": "Postura e enquadramento ex Centralizado De lado Inclinado",
    "tags": ["tag1", "tag2", "tag3"]
  }
}`;

    setLoadingStep(3);

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${state.apiKey}`,
        "HTTP-Referer": window.location.href,
        "X-Title": "FaceScan",
      },
      body: JSON.stringify({
        model: state.model,
        max_tokens: 2000,
        temperature: 0.2,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } },
          ],
        }],
      }),
    });

    setLoadingStep(4);

    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e?.error?.message || "HTTP " + res.status);
    }

    const data = await res.json();
    setLoadingStep(5);

    const text = data.choices?.[0]?.message?.content || "";
    if (!text) throw new Error("Resposta vazia do modelo");

    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Formato de resposta inválido");
    const parsed = JSON.parse(match[0]);

    await delay(200);
    return parsed;
  }

  /* ── Popup ────────────────────────────────────────────────── */
  function renderPopup(data, imageData) {
    hideLoading();
    const wi = data.web_info || {};
    const st = data.status   || {};

    $("popup-photo").src = imageData;

    // Confiança
    const pct = wi.confidence_pct || (wi.confidence === "Alta" ? 88 : wi.confidence === "Média" ? 60 : 35);
    $("conf-val").textContent = pct + "%";
    setTimeout(() => ($("conf-fill").style.width = pct + "%"), 100);

    $("popup-meta").innerHTML =
      escHtml(wi.occupation||"—") + "<br>" + escHtml(wi.nationality||"—") + "<br>" + escHtml(wi.born||"—");

    // ── BLOCO WEB INFO ──
    $("popup-name").textContent    = wi.name    || "Desconhecido";
    $("popup-summary").textContent = wi.summary || "—";

    const wiTags = $("popup-tags");
    wiTags.innerHTML = "";
    const tags1 = [...(wi.tags || [])];
    if (wi.confidence) tags1.unshift(wi.confidence + " CONF.");
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

    // ── BLOCO STATUS ──
    const stGrid = $("popup-status-grid");
    stGrid.innerHTML = "";
    [
      { label:"😄 HUMOR",       value: st.humor          || "—" },
      { label:"😐 EXPRESSÃO",   value: st.expressao      || "—" },
      { label:"👤 CARACTERÍSTICAS", value: st.caracteristicas || "—" },
      { label:"🏠 AMBIENTE",    value: st.ambiente       || "—" },
      { label:"💡 ILUMINAÇÃO",  value: st.iluminacao     || "—" },
      { label:"🧍 POSTURA",     value: st.postura        || "—" },
    ].forEach(dp => {
      stGrid.innerHTML += `<div class="info-item"><div class="info-item-label">${escHtml(dp.label)}</div><div class="info-item-value">${escHtml(dp.value)}</div></div>`;
    });

    const stTags = $("popup-status-tags");
    stTags.innerHTML = "";
    (st.tags || []).slice(0,6).forEach(t => {
      stTags.innerHTML += `<span class="tag yellow">${escHtml(t)}</span>`;
    });

    $("sources-section").style.display = "none";
    $("popup-timestamp").textContent = "ANÁLISE: " + new Date().toLocaleString("pt-BR");
    $("result-popup").classList.add("active");
  }

  function renderErrorPopup(msg) {
    hideLoading();
    $("popup-photo").src           = state.lastCapture || "";
    $("popup-name").textContent    = "ERRO NA ANÁLISE";
    $("popup-desc").textContent    = msg;
    $("popup-summary").textContent = "Verifique sua conexão e a chave API, depois tente novamente.";
    $("popup-tags").innerHTML      = '<span class="tag red">FALHA</span>';
    $("popup-info-grid").innerHTML = "";
    $("popup-sources").innerHTML   = "";
    $("conf-val").textContent = "0%"; $("conf-fill").style.width = "0%";
    $("popup-meta").textContent = "—";
    $("popup-timestamp").textContent = new Date().toLocaleString("pt-BR");
    $("sources-section").style.display = "none";
    $("result-popup").classList.add("active");
  }

  function closePopup() { $("result-popup").classList.remove("active"); }

  /* ── Loading ──────────────────────────────────────────────── */
  const STEPS = [
    "◦ Capturando frame...", "◦ Enviando para Gemini Vision...",
    "◦ Ativando Google Search...", "◦ Compilando dados...", "◦ Gerando perfil...",
  ];

  function showLoading() { resetLoadingSteps(); $("loading-overlay").classList.add("active"); $("cam-wrapper").classList.add("scanning"); }
  function hideLoading() { $("loading-overlay").classList.remove("active"); $("cam-wrapper").classList.remove("scanning"); }

  function setLoadingStep(n) {
    for (let i = 1; i <= 5; i++) {
      const el = $("step" + i);
      el.className   = i < n ? "loading-step done" : i === n ? "loading-step active" : "loading-step";
      el.textContent = i < n ? STEPS[i-1].replace("◦","✓") : STEPS[i-1];
    }
  }
  function resetLoadingSteps() { for (let i=1;i<=5;i++) { $("step"+i).className="loading-step"; $("step"+i).textContent=STEPS[i-1]; } }

  /* ── Log ──────────────────────────────────────────────────── */
  function log(msg, type = "") {
    const area = $("log-area");
    const time = new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
    const line = document.createElement("div");
    line.className = "log-line";
    line.innerHTML = `<span class="log-time">[${time}]</span><span class="log-text ${type}">${escHtml(msg)}</span>`;
    area.appendChild(line);
    area.scrollTop = area.scrollHeight;
    while (area.children.length > 50) area.removeChild(area.firstChild);
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
  function testApiKey() {
    return fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${state.apiKey}`,
        "HTTP-Referer": window.location.href,
        "X-Title": "FaceScan",
      },
      body: JSON.stringify({
        model: state.model,
        max_tokens: 5,
        messages: [{ role: "user", content: "OK" }],
      }),
    }).then(async r => { if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e?.error?.message||"HTTP "+r.status); } });
  }

  function setDot(id, online) {
    const el = $(id);
    el.style.background = online ? "var(--green)" : "var(--red)";
    el.style.boxShadow  = online ? "var(--glow-green)" : "0 0 8px var(--red)";
    el.classList.toggle("red", !online);
  }

  function showError(msg) { const el=$("key-error"); el.textContent="⚠ "+msg; el.style.display="block"; }
  function hideError()     { $("key-error").style.display="none"; }
  function escHtml(s)      { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  const delay = ms => new Promise(r => setTimeout(r, ms));

  /* ── Eventos globais ──────────────────────────────────────── */
  document.getElementById("result-popup").addEventListener("click", e => { if (e.target===e.currentTarget) closePopup(); });
  document.addEventListener("keydown", e => { if (e.key==="Escape") closePopup(); if (e.key==="Enter"&&$("setup-screen").style.display!=="none") init(); });

  return { init, scanFace, resetSession, closePopup };

})();

/* Verifica config ao carregar */
document.addEventListener("DOMContentLoaded", () => {
  const box = document.getElementById("key-status-display");
  const btn = document.getElementById("start-btn");

  if (typeof ENV === "undefined" || !ENV.OPENROUTER_API_KEY) {
    box.textContent = "⚠ ENV não encontrado — verifique config/config.js";
    box.style.color = "var(--red)"; btn.disabled = true; return;
  }
  if (ENV.OPENROUTER_API_KEY === "SUA_CHAVE_AQUI" || ENV.OPENROUTER_API_KEY.length < 20) {
    box.textContent = "⚠ Chave não configurada — edite config/config.js";
    box.style.color = "var(--yellow)"; btn.disabled = true; return;
  }

  const masked = ENV.OPENROUTER_API_KEY.slice(0,6) + "••••••••" + ENV.OPENROUTER_API_KEY.slice(-4);
  box.textContent = "✓ Chave OpenRouter detectada (" + masked + ")";
  box.style.color = "var(--green)";
});