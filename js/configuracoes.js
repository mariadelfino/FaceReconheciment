"use strict";

window.ConfiguracoesPage = (() => {
  const TEMPLATE = `
    <div class="app-shell">
      <div data-sidebar data-sidebar-active="settings"></div>

      <main class="app-content settings-content">
        <div class="settings-hero">
          <h1>Configurações</h1>
          <p>
            Configure os serviços e recursos necessários para o funcionamento da plataforma.
          </p>
        </div>

        <p class="setup-subtitle">
          Configure suas chaves no arquivo <code>config/config.js</code> antes de iniciar.<br />
          <strong>Gemini API</strong>: obtenha gratuitamente em
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener">aistudio.google.com</a>.<br />
          <strong>Azure Face API</strong>: crie um recurso Face em
          <a href="https://portal.azure.com" target="_blank" rel="noopener">portal.azure.com</a>
          (30.000 req/mes gratis).
        </p>

        <div class="field-label">STATUS GEMINI + GOOGLE SEARCH</div>
        <div id="key-status-display" class="key-status-box">Verificando config...</div>

        <div class="field-label" style="margin-top:10px">STATUS AZURE FACE API</div>
        <div id="azure-status-display" class="key-status-box">Verificando config...</div>

        <div class="field-label" style="margin-top:10px">STATUS FACECHECK.ID</div>
        <div id="facecheck-status-display" class="key-status-box">Verificando config...</div>

        <div id="key-error" class="error-msg"></div>

        <p class="hint">
          Identificação: <strong>Gemini + Google Search</strong> — busca e monta o perfil em tempo real<br />
          Busca reversa: <strong>FaceCheck.ID</strong> — encontra a pessoa na internet por foto<br />
          Biometria: <strong>Azure Face API</strong> — emoção, idade, genero e mais<br />
          <span class="hint-warn">As chaves nunca saem do seu dispositivo.</span>
        </p>
      </main>
    </div>`;

  function open() {
    const settingsScreen = document.getElementById("settings-screen");
    if (!settingsScreen) return;

    settingsScreen.innerHTML = TEMPLATE;
    if (window.SidebarComponent && typeof window.SidebarComponent.loadAll === "function") {
      window.SidebarComponent.loadAll(settingsScreen).catch(() => {});
    }

    settingsScreen.style.display = "block";

    const appScreen = document.getElementById("app-screen");
    if (appScreen) appScreen.style.display = "none";

    const logScreen = document.getElementById("log-screen");
    if (logScreen) logScreen.style.display = "none";

    if (typeof refreshConfigStatusPanel === "function") {
      refreshConfigStatusPanel();
    }
  }

  return { open };
})();