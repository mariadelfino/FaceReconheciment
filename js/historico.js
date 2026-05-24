"use strict";

window.HistoricoPage = (() => {
  const TEMPLATE = `
    <div class="history-page">
      <div class="app-shell">
        <div data-sidebar data-sidebar-active="history"></div>

        <main class="app-content history-content">
          <div class="settings-hero">
            <h1>Histórico de análises</h1>
            <p>
              Aqui você pode rever as pesquisas realizadas anteriormente, mesmo depois de sair da tela inicial.
            </p>
          </div>

          <p class="setup-subtitle">
            As análises ficam salvas localmente neste dispositivo. Selecione um item para ver os dados completos novamente.
          </p>

          <div class="history-grid">
            <section class="setup-card settings-card history-list-card">
              <div class="card-title"><i class="bi bi-collection-play" aria-hidden="true"></i> ANÁLISES SALVAS</div>
              <div id="history-list" class="history-list"></div>
            </section>

            <section class="setup-card settings-card history-detail-card">
              <div class="card-title"><i class="bi bi-info-circle" aria-hidden="true"></i> DETALHES</div>
              <div id="history-empty" class="history-empty">
                Selecione uma análise na lista para ver a foto, fontes e resumo.
              </div>
              <div id="history-detail" class="history-detail" style="display:none">
                <div class="history-hero">
                  <div class="history-photo-wrap">
                    <img id="history-photo" class="history-photo" alt="Foto da análise" />
                  </div>
                  <div class="history-hero-meta">
                    <div class="history-person" id="history-name">—</div>
                    <div class="history-time" id="history-time">—</div>
                    <div class="history-tags" id="history-tags"></div>
                  </div>
                </div>

                <div class="history-summary" id="history-summary">—</div>

                <div class="history-sections">
                  <div class="history-block">
                    <div class="card-title"><i class="bi bi-globe2" aria-hidden="true"></i> DADOS NA WEB</div>
                    <div class="history-meta" id="history-web-meta"></div>
                    <div class="info-grid" id="history-web-grid"></div>
                  </div>

                  <div class="history-block">
                    <div class="card-title"><i class="bi bi-broadcast" aria-hidden="true"></i> STATUS ATUAL</div>
                    <div class="info-grid" id="history-status-grid"></div>
                  </div>

                  <div class="history-block" id="history-azure-block" style="display:none">
                    <div class="card-title"><i class="bi bi-cpu" aria-hidden="true"></i> BIOMETRIA — AZURE FACE</div>
                    <div class="info-grid" id="history-azure-grid"></div>
                  </div>

                  <div class="history-block" id="history-sources-block" style="display:none">
                    <div class="card-title"><i class="bi bi-search" aria-hidden="true"></i> FONTES</div>
                    <div class="sources-list" id="history-sources"></div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>`;

  let selectedId = "";

  function getEntries() {
    try {
      const raw = localStorage.getItem("facescan-analysis-history");
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
      return [];
    }
  }

  function open() {
    const historyScreen = document.getElementById("history-screen");
    if (!historyScreen) return;

    historyScreen.innerHTML = TEMPLATE;
    if (window.SidebarComponent && typeof window.SidebarComponent.loadAll === "function") {
      window.SidebarComponent.loadAll(historyScreen).catch(() => {});
    }

    historyScreen.style.display = "block";
    const appScreen = document.getElementById("app-screen");
    if (appScreen) appScreen.style.display = "none";
    const settingsScreen = document.getElementById("settings-screen");
    if (settingsScreen) settingsScreen.style.display = "none";
    const logScreen = document.getElementById("log-screen");
    if (logScreen) logScreen.style.display = "none";

    const entries = getEntries();
    if (!selectedId || !entries.some(entry => entry.id === selectedId)) {
      selectedId = entries[0] ? entries[0].id : "";
    }

    renderList();
    if (selectedId) {
      renderDetail(selectedId);
    }
  }

  function renderList() {
    const list = document.getElementById("history-list");
    if (!list) return;

    const entries = getEntries();
    if (entries.length === 0) {
      list.innerHTML = `
        <div class="history-empty history-empty-inline">
          Nenhuma análise salva ainda.
        </div>`;
      const detail = document.getElementById("history-detail");
      const empty = document.getElementById("history-empty");
      if (detail) detail.style.display = "none";
      if (empty) empty.style.display = "flex";
      return;
    }

    list.innerHTML = entries.map(entry => {
      const data = entry.data || {};
      const web = data.web_info || {};
      const name = web.name || "Desconhecido";
      const time = formatTimestamp(entry.timestamp);
      const active = entry.id === selectedId ? "active" : "";
      return `
        <button class="history-item ${active}" type="button" data-history-id="${escapeHtml(entry.id)}">
          <div class="history-item-photo">
            <img src="${escapeHtml(entry.imageData || "")}" alt="Miniatura" />
          </div>
          <div class="history-item-copy">
            <div class="history-item-name">${escapeHtml(name)}</div>
            <div class="history-item-time">${escapeHtml(time)}</div>
            <div class="history-item-summary">${escapeHtml(web.summary || "Sem resumo disponível")}</div>
          </div>
        </button>`;
    }).join("");

    list.querySelectorAll("[data-history-id]").forEach(button => {
      button.addEventListener("click", () => {
        selectedId = button.dataset.historyId || "";
        renderList();
        renderDetail(selectedId);
      });
    });
  }

  function renderDetail(entryId) {
    const entry = getEntries().find(item => item.id === entryId);
    const detail = document.getElementById("history-detail");
    const empty = document.getElementById("history-empty");
    if (!detail || !empty || !entry) return;

    const data = entry.data || {};
    const web = data.web_info || {};
    const st = data.status || {};
    const azure = entry.azure || null;
    const faceItems = entry.faceItems || [];
    const geminiSources = data._geminiSources || [];

    detail.style.display = "block";
    empty.style.display = "none";
    selectedId = entry.id;

    const photo = document.getElementById("history-photo");
    const name = document.getElementById("history-name");
    const time = document.getElementById("history-time");
    const tags = document.getElementById("history-tags");
    const summary = document.getElementById("history-summary");
    const webMeta = document.getElementById("history-web-meta");
    const webGrid = document.getElementById("history-web-grid");
    const statusGrid = document.getElementById("history-status-grid");
    const azureBlock = document.getElementById("history-azure-block");
    const azureGrid = document.getElementById("history-azure-grid");
    const sourcesBlock = document.getElementById("history-sources-block");
    const sourcesList = document.getElementById("history-sources");

    if (photo) photo.src = entry.imageData || "";
    if (name) name.textContent = web.name || "Desconhecido";
    if (time) time.textContent = formatTimestamp(entry.timestamp);
    if (summary) summary.textContent = web.summary || "—";
    if (webMeta) webMeta.innerHTML = `${escapeHtml(web.occupation || "—")}<br>${escapeHtml(web.nationality || "—")}<br>${escapeHtml(web.born || "—")}`;

    if (tags) {
      const allTags = [...(web.tags || [])];
      if (web.confidence) allTags.unshift(web.confidence + " CONF.");
      if (geminiSources.length > 0) allTags.push("GOOGLE SEARCH");
      if (faceItems.length > 0) allTags.push("WEB MATCH");
      tags.innerHTML = allTags.slice(0, 8).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("");
    }

    if (webGrid) {
      webGrid.innerHTML = [
        { label: "IDENTIFICADO", value: web.identified ? "SIM" : "NÃO" },
        { label: "PROFISSÃO", value: web.occupation || "—" },
        { label: "NACIONALIDADE", value: web.nationality || "—" },
        { label: "NASCIMENTO", value: web.born || "—" },
        { label: "CONHECIDO POR", value: web.known_for || "—" },
      ].map(item => `<div class="info-item"><div class="info-item-label">${escapeHtml(item.label)}</div><div class="info-item-value">${escapeHtml(item.value)}</div></div>`).join("");
    }

    if (statusGrid) {
      statusGrid.innerHTML = [
        { label: "HUMOR", value: st.humor || "—" },
        { label: "EXPRESSÃO", value: st.expressao || "—" },
        { label: "CARACTERÍSTICAS", value: st.caracteristicas || "—" },
        { label: "AMBIENTE", value: st.ambiente || "—" },
        { label: "ILUMINAÇÃO", value: st.iluminacao || "—" },
        { label: "POSTURA", value: st.postura || "—" },
      ].map(item => `<div class="info-item"><div class="info-item-label">${escapeHtml(item.label)}</div><div class="info-item-value">${escapeHtml(item.value)}</div></div>`).join("");
    }

    if (azureBlock && azureGrid) {
      if (azure) {
        azureBlock.style.display = "block";
        azureGrid.innerHTML = [
          { label: "EMOÇÃO DOMINANTE", value: getTopEmotion(azure.emotion) },
          { label: "IDADE ESTIMADA", value: azure.age !== undefined ? Math.round(azure.age) + " anos" : "—" },
          { label: "GÊNERO", value: azure.gender || "—" },
          { label: "SORRISO", value: azure.smile !== undefined ? Math.round(azure.smile * 100) + "%" : "—" },
          { label: "ÓCULOS", value: azure.glasses || "—" },
          { label: "CABELO", value: getHairDescription(azure.hair) },
          { label: "PELOS FACIAIS", value: getFacialHairDesc(azure.facialHair) },
          { label: "POSE DA CABEÇA", value: azure.headPose ? `Yaw ${azure.headPose.yaw.toFixed(0)}° / Pitch ${azure.headPose.pitch.toFixed(0)}° / Roll ${azure.headPose.roll.toFixed(0)}°` : "—" },
        ].map(item => `<div class="info-item"><div class="info-item-label">${escapeHtml(item.label)}</div><div class="info-item-value">${escapeHtml(item.value)}</div></div>`).join("");
      } else {
        azureBlock.style.display = "none";
      }
    }

    if (sourcesBlock && sourcesList) {
      const allSources = [
        ...geminiSources.map(source => ({ url: source.url, title: source.title, score: null, type: "google" })),
        ...faceItems.slice(0, 4).map(source => ({ url: source.url, title: "", score: source.score, type: "facecheck" })),
      ];

      if (allSources.length > 0) {
        sourcesBlock.style.display = "block";
        sourcesList.innerHTML = allSources.slice(0, 8).map(item => `
          <div class="source-item">
            <div class="source-score">${item.type === "google" ? "🔍" : escapeHtml(String(item.score || ""))}</div>
            <div class="source-info">
              <div class="source-domain">${escapeHtml(item.title || extractDomain(item.url))}</div>
              <a class="source-url" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">${escapeHtml(item.url)}</a>
            </div>
          </div>`).join("");
      } else {
        sourcesBlock.style.display = "none";
      }
    }
  }

  function formatTimestamp(value) {
    try {
      return new Date(value).toLocaleString("pt-BR");
    } catch (_) {
      return value || "—";
    }
  }

  function extractDomain(url) {
    try { return new URL(url).hostname.replace("www.", ""); } catch (_) { return url || "—"; }
  }

  function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function getTopEmotion(emotions) {
    if (!emotions) return "—";
    const map = { anger:"Raiva", contempt:"Desprezo", disgust:"Nojo", fear:"Medo", happiness:"Felicidade", neutral:"Neutro", sadness:"Tristeza", surprise:"Surpresa" };
    const [key, val] = Object.entries(emotions).sort((a, b) => b[1] - a[1])[0] || [];
    return key ? (map[key] || key) + " (" + Math.round(val * 100) + "%)" : "—";
  }

  function getHairDescription(hair) {
    if (!hair) return "—";
    if (hair.invisible) return "Não visível";
    if (hair.bald > 0.7) return "Calvo";
    const colorMap = { black:"Preto", blond:"Loiro", brown:"Castanho", gray:"Grisalho", red:"Ruivo", white:"Branco", other:"Outro" };
    const topColor = (hair.hairColor || []).sort((a, b) => b.confidence - a.confidence)[0];
    return topColor ? (colorMap[topColor.color] || topColor.color) : "—";
  }

  function getFacialHairDesc(fh) {
    if (!fh) return "—";
    const parts = [];
    if (fh.beard > 0.3) parts.push("Barba");
    if (fh.moustache > 0.3) parts.push("Bigode");
    if (fh.sideburns > 0.3) parts.push("Suíças");
    return parts.length > 0 ? parts.join(", ") : "Não detectado";
  }

  return { open, renderList, renderDetail };
})();