"use strict";

(() => {
  const SIDEBAR_PARTIAL_PATH = "components/sidebar.html";
  const SIDEBAR_FALLBACK_MARKUP = `
<aside class="sidebar">
  <div class="sidebar-brand">
    <img src="img/logo.svg" alt="Face Scan" class="sidebar-logo" />
  </div>

  <nav class="sidebar-nav" aria-label="Navegacao principal">
    <button class="sidebar-item" type="button" data-sidebar-item="home" onclick="if (typeof App !== 'undefined' && typeof App.openMainPage === 'function') App.openMainPage();">
      <span class="sidebar-icon"><i class="bi bi-house-door" aria-hidden="true"></i></span>
      <span>Visor principal</span>
    </button>

    <button class="sidebar-item" type="button" data-sidebar-item="history" onclick="if (typeof HistoricoPage !== 'undefined' && typeof HistoricoPage.open === 'function') HistoricoPage.open(); else if (typeof App !== 'undefined' && typeof App.openHistoryPage === 'function') App.openHistoryPage();">
      <span class="sidebar-icon"><i class="bi bi-clock-history" aria-hidden="true"></i></span>
      <span>Histórico</span>
    </button>

    <button class="sidebar-item" type="button" data-sidebar-item="log" onclick="if (typeof LogDoSistemaPage !== 'undefined' && typeof LogDoSistemaPage.open === 'function') LogDoSistemaPage.open(); else if (typeof App !== 'undefined' && typeof App.openLogPage === 'function') App.openLogPage();">
      <span class="sidebar-icon"><i class="bi bi-journal-text" aria-hidden="true"></i></span>
      <span>Log do Sistema</span>
    </button>

    <button class="sidebar-item" type="button" data-sidebar-item="settings" onclick="if (typeof ConfiguracoesPage !== 'undefined' && typeof ConfiguracoesPage.open === 'function') ConfiguracoesPage.open(); else if (typeof App !== 'undefined' && typeof App.openSettingsPage === 'function') App.openSettingsPage();">
      <span class="sidebar-icon"><i class="bi bi-gear" aria-hidden="true"></i></span>
      <span>Configurações</span>
    </button>
  </nav>

  <div class="sidebar-status-card">
    <div class="sidebar-status-dot"></div>
    <div>
      <div class="sidebar-status-title">Sistema</div>
      <div class="sidebar-status-text">Monitoramento ativo</div>
    </div>
  </div>
</aside>`;
  let sidebarMarkupPromise = null;

  function getSidebarMarkup() {
    if (!sidebarMarkupPromise) {
      sidebarMarkupPromise = fetch(SIDEBAR_PARTIAL_PATH)
        .then(res => {
          if (!res.ok) throw new Error("Falha ao carregar sidebar");
          return res.text();
        })
        .catch(() => SIDEBAR_FALLBACK_MARKUP);
    }
    return sidebarMarkupPromise;
  }

  function applyActiveItem(container) {
    const activeKey = container.dataset.sidebarActive || "";
    if (!activeKey) return;
    container.querySelectorAll("[data-sidebar-item]").forEach(item => {
      const isActive = item.dataset.sidebarItem === activeKey;
      item.classList.toggle("active", isActive);
      if (isActive) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
  }

  async function injectSidebar(container) {
    if (!container || container.dataset.sidebarLoaded === "true") return;
    const markup = await getSidebarMarkup();
    container.innerHTML = markup;
    container.dataset.sidebarLoaded = "true";
    applyActiveItem(container);
  }

  async function loadAll(root = document) {
    const containers = root.querySelectorAll("[data-sidebar]");
    await Promise.all(Array.from(containers).map(injectSidebar));
  }

  window.SidebarComponent = {
    loadAll,
    injectSidebar,
  };

  document.addEventListener("DOMContentLoaded", () => {
    loadAll().catch(() => {});
  });
})();
