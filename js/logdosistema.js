"use strict";

window.LogDoSistemaPage = (() => {
  const TEMPLATE = `
    <div class="log-page">
      <div class="app-shell">
        <div data-sidebar data-sidebar-active="log"></div>

        <main class="app-content log-content">
          <div class="settings-hero">
            <h1>Log do Sistema</h1>
            <p>
              Esta página concentra os registros gerados durante a execução do scanner e das integrações.
            </p>
          </div>

          <p class="setup-subtitle">
            Aqui ficam os eventos gerados pelo scanner, pelas APIs e pelo fluxo de análise.
          </p>

          <div class="field-label">LOG DO SISTEMA</div>
          <div class="log-area log-page-area" id="log-page-area">
            <div class="log-line">
              <span class="log-time">[INIT]</span>
              <span class="log-text ok">Sistema carregado</span>
            </div>
          </div>
        </main>
      </div>
    </div>`;

  function open() {
    const logScreen = document.getElementById("log-screen");
    if (!logScreen) return;

    logScreen.innerHTML = TEMPLATE;
    if (window.SidebarComponent && typeof window.SidebarComponent.loadAll === "function") {
      window.SidebarComponent.loadAll(logScreen).catch(() => {});
    }

    logScreen.style.display = "block";

    const appScreen = document.getElementById("app-screen");
    if (appScreen) appScreen.style.display = "none";

    const settingsScreen = document.getElementById("settings-screen");
    if (settingsScreen) settingsScreen.style.display = "none";

    if (typeof App !== "undefined" && typeof App.renderLogArea === "function") {
      App.renderLogArea(logScreen);
    }
  }

  return { open };
})();