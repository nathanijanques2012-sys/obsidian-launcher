/**
 * Obsidian Launcher - Main Entry Point
 * Arquitetura modular com lazy loading de páginas
 */

import { API, toast, VirtualList, Skeleton, debounce, createSearchInput, populateVersionSelect, escapeHtml } from './utils/index.js';

// Estado global da aplicação
const state = {
  currentPage: 'play',
  settings: null,
  account: null,
  versions: [],
  searchCache: new Map(),
  virtualLists: new Map(),
  pageModules: new Map(),
  isLoading: false
};

// Elementos DOM principais
const els = {
  sidebar: null,
  content: null,
  pages: new Map(),
  navButtons: new Map()
};

/**
 * Inicializa aplicação
 */
async function init() {
  console.log('[Obsidian] Iniciando launcher...');
  
  // Cacheia elementos
  cacheElements();
  
  // Setup navegação
  setupNavigation();
  
  // Carrega dados iniciais em paralelo
  await loadInitialData();
  
  // Renderiza página ativa
  await renderPage(state.currentPage);
  
  // Setup listeners globais
  setupGlobalListeners();
  
  // Setup enhancements
  setupGlobalSearch();
  setupSidebarToggle();
  
  console.log('[Obsidian] Launcher pronto!');
}

/**
 * Cacheia referências DOM
 */
function cacheElements() {
  els.sidebar = document.querySelector('.sidebar');
  els.content = document.querySelector('.content');
  
  // Páginas
  document.querySelectorAll('.page').forEach(page => {
    els.pages.set(page.id.replace('page-', ''), page);
  });
  
  // Botões de navegação
  document.querySelectorAll('.nav').forEach(btn => {
    els.navButtons.set(btn.dataset.page, btn);
  });
}

/**
 * Setup navegação entre páginas
 */
function setupNavigation() {
  document.querySelectorAll('.nav').forEach(btn => {
    btn.addEventListener('click', async () => {
      const page = btn.dataset.page;
      if (page === state.currentPage) return;
      await navigateTo(page);
    });
  });
}

/**
 * Navega para uma página com lazy loading
 */
async function navigateTo(pageName) {
  // Atualiza UI de navegação
  els.navButtons.forEach((btn, name) => {
    btn.classList.toggle('active', name === pageName);
  });
  els.pages.forEach((pageEl, name) => {
    pageEl.classList.toggle('active', name === pageName);
  });
  
  state.currentPage = pageName;
  
  // Lazy load do módulo da página
  await renderPage(pageName);
  
  // Scroll para topo
  els.content.scrollTop = 0;
  
  // Analytics / logging
  console.log(`[Obsidian] Navegou para: ${pageName}`);
}

/**
 * Renderiza página (lazy load do módulo)
 */
async function renderPage(pageName) {
  // Se já carregou, só chama render
  if (state.pageModules.has(pageName)) {
    const mod = state.pageModules.get(pageName);
    if (mod.render) await mod.render();
    return;
  }

  // NÃO apaga o HTML estático da seção: os módulos preenchem os
  // sub-containers (cada um mostra seu próprio skeleton). Apagar aqui
  // quebra páginas cujos inputs vivem no HTML (mods, skins, amigos...).
  try {
    // Dynamic import - code splitting!
    const mod = await import(`./pages/${pageName}.js`);
    state.pageModules.set(pageName, mod);

    // Inicializa módulo
    if (mod.init) await mod.init({ state, API, toast, els, VirtualList, Skeleton, debounce, createSearchInput });

    // Renderiza
    if (mod.render) await mod.render();
  } catch (err) {
    console.error(`[Obsidian] Erro ao carregar página ${pageName}:`, err);
    toast.error('Erro ao carregar página', pageName);
    const pageEl = els.pages.get(pageName);
    if (pageEl) Skeleton.hideSkeleton(pageEl, `<div class="card"><h2>Erro ao carregar</h2><p class="muted">${err.message}</p></div>`);
  }
}

/**
 * Carrega dados iniciais em paralelo
 */
async function loadInitialData() {
  try {
    const [settings, account, versions] = await Promise.allSettled([
      API.getSettings(),
      API.getAccount(),
      API.getVersions()
    ]);
    
    state.settings = settings.status === 'fulfilled' ? settings.value : getDefaultSettings();
    state.account = account.status === 'fulfilled' ? account.value : null;
    state.versions = versions.status === 'fulfilled' ? versions.value : ['1.21', '1.20.4', '1.19.4'];
    
    // Atualiza UI com dados
    applySettingsToUI(state.settings);
    updateAccountUI(state.account);
    populateVersionSelect(state.versions);
    updateContextLabels();
    
    // Carrega listas instaladas em background
    loadInstalledListsBackground();
    
  } catch (err) {
    console.error('[Obsidian] Erro ao carregar dados iniciais:', err);
    toast.error('Erro ao inicializar', 'Verifique o console para detalhes');
  }
}

/**
 * Configura listeners globais (IPC events)
 */
function setupGlobalListeners() {
  // Log do jogo
  API.onLog((msg) => {
    const logEl = document.getElementById('log');
    if (logEl) {
      logEl.textContent += msg + '\n';
      logEl.scrollTop = logEl.scrollHeight;
    }
  });
  
  // Progresso de launch/download
  API.onProgress((progress) => {
    const progressEl = document.getElementById('progress');
    const barFill = document.getElementById('barFill');
    if (progressEl) {
      progressEl.textContent = progress?.type 
        ? `${progress.type} ${progress.task || ''} ${progress.percentage || ''}`
        : JSON.stringify(progress);
    }
    if (barFill && typeof progress?.percentage === 'number') {
      barFill.style.width = Math.min(100, progress.percentage) + '%';
    }
  });
  
  // Status de atualização
  API.onUpdateStatus((msg) => {
    const updStatus = document.getElementById('updStatus');
    if (updStatus) updStatus.textContent = msg;
  });
  
  API.onUpdateReady(() => {
    const btnRestart = document.getElementById('btnRestart');
    if (btnRestart) btnRestart.style.display = 'block';
    toast.success('Atualização pronta', 'Clique em "Reiniciar e atualizar" para aplicar');
  });
  
  // Game started/stopped
  API.onGameStarted(() => setPlaying(true));
  API.onGameClosed(() => setPlaying(false));
}

/**
 * Carrega listas instaladas em background (não bloqueia UI)
 */
async function loadInstalledListsBackground() {
  try {
    await Promise.allSettled([
      API.contentList('shader').then(r => updateInstalledList('shader', r)),
      API.contentList('resourcepack').then(r => updateInstalledList('resourcepack', r)),
      API.contentList('modpack').then(r => updateInstalledList('modpack', r)),
      API.skinList().then(r => updateSkinsList(r)),
      API.friendsList().then(r => updateFriendsList(r))
    ]);
  } catch (err) {
    console.warn('[Obsidian] Erro ao carregar listas em background:', err);
  }
}

// ===== Helpers de UI =====

function getDefaultSettings() {
  return {
    ramMin: '2G', ramMax: '4G',
    javaPath: '', gameDir: '',
    resolution: { width: 854, height: 480 },
    version: '26.3', loader: 'fabric',
    autoUpdate: true, overlay: true,
    displayMode: 'window', softwareGL: false
  };
}

function applySettingsToUI(s) {
  const map = {
    ramMin: 'ramMin', ramMax: 'ramMax',
    javaPath: 'javaPath', gameDir: 'gameDir',
    w: 'resolution.width', h: 'resolution.height',
    loader: 'loader', autoUpdate: 'autoUpdate',
    overlay: 'overlay', softwareGL: 'softwareGL',
    displayMode: 'displayMode'
  };
  
  Object.entries(map).forEach(([elId, path]) => {
    const el = document.getElementById(elId);
    if (!el) return;
    const value = path.split('.').reduce((o, k) => o?.[k], s);
    if (value !== undefined) {
      if (el.type === 'checkbox') el.checked = value;
      else el.value = value;
    }
  });
}

function updateAccountUI(account) {
  const userEl = document.getElementById('user');
  if (userEl) userEl.textContent = account ? `${account.name} (${account.type})` : 'Não logado';
}

function updateContextLabels() {
  const label = `${state.settings?.loader || 'fabric'} • ${state.settings?.version || '26.3'}`;
  ['modsCtx', 'shadersCtx', 'packsCtx', 'modpacksCtx'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = label;
  });
}

function setPlaying(playing) {
  const btnPlay = document.getElementById('btnPlay');
  const btnStop = document.getElementById('btnStop');
  const barFill = document.getElementById('barFill');
  if (btnPlay) btnPlay.style.display = playing ? 'none' : '';
  if (btnStop) btnStop.style.display = playing ? '' : 'none';
  if (barFill) barFill.style.width = playing ? '100%' : '5%';
}

// ===== Handlers de ações globais (delegados) =====

// Config salvar
const btnSave = document.getElementById('btnSave');
if (btnSave) {
  btnSave.onclick = async () => {
    const saveMsg = document.getElementById('saveMsg');
    if (saveMsg) saveMsg.textContent = 'Salvando...';
    
    const newSettings = {
      ramMin: $('ramMin').value, ramMax: $('ramMax').value,
      javaPath: $('javaPath').value, gameDir: $('gameDir').value || undefined,
      resolution: { width: +$('w').value, height: +$('h').value },
      version: $('version').value, loader: $('loader').value,
      autoUpdate: $('autoUpdate').checked, overlay: $('overlay').checked,
      displayMode: $('displayMode').value, softwareGL: $('softwareGL').checked
    };
    
    try {
      await API.saveSettings(newSettings);
      state.settings = { ...state.settings, ...newSettings };
      updateContextLabels();
      if (saveMsg) saveMsg.textContent = '✓ Config salva!';
      toast.success('Configurações salvas');
      setTimeout(() => { if (saveMsg) saveMsg.textContent = ''; }, 3000);
    } catch (err) {
      if (saveMsg) saveMsg.textContent = 'Erro ao salvar';
      toast.error('Erro ao salvar config', err.message);
    }
  };
}

// Login Microsoft
const btnLogin = document.getElementById('btnLogin');
if (btnLogin) {
  btnLogin.onclick = async () => {
    try {
      btnLogin.disabled = true;
      btnLogin.textContent = 'Conectando...';
      const account = await API.login();
      state.account = account;
      updateAccountUI(account);
      toast.success('Login realizado', `Bem-vindo, ${account.name}!`);
    } catch (err) {
      toast.error('Login falhou', err.message);
    } finally {
      btnLogin.disabled = false;
      btnLogin.textContent = 'Login Microsoft';
    }
  };
}

// Login Offline
const btnOffline = document.getElementById('btnOffline');
if (btnOffline) {
  btnOffline.onclick = async () => {
    const name = document.getElementById('offlineName').value.trim();
    if (!name) return toast.warning('Nick vazio', 'Digite um nome para jogar offline');
    try {
      const account = await API.offlineLogin(name);
      state.account = account;
      updateAccountUI(account);
      toast.success('Modo offline', `Logado como ${name}`);
    } catch (err) {
      toast.error('Login offline falhou', err.message);
    }
  };
}

// Logout
const btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
  btnLogout.onclick = async () => {
    await API.logout();
    state.account = null;
    updateAccountUI(null);
    toast.info('Deslogado', 'Sessão encerrada');
  };
}

// Jogar
const btnPlay = document.getElementById('btnPlay');
if (btnPlay) {
  btnPlay.onclick = async () => {
    if (!state.account) return toast.warning('Não logado', 'Faça login Microsoft ou offline primeiro');
    if (btnPlay.disabled) return; // sem duplo-clique (2 jogos colidem nos natives)
    btnPlay.disabled = true;

    const logEl = document.getElementById('log');
    if (logEl) logEl.textContent += 'Iniciando...\n';

    try {
      await API.launch({
        version: $('version').value,
        loader: $('loader').value
      });
      setPlaying(true);
    } catch (err) {
      if (logEl) logEl.textContent += 'ERRO: ' + err.message + '\n';
      setPlaying(false);
      toast.error('Falha ao iniciar', err.message);
    } finally {
      btnPlay.disabled = false;
    }
  };
}

// Parar
const btnStop = document.getElementById('btnStop');
if (btnStop) {
  btnStop.onclick = async () => {
    btnStop.disabled = true;
    try {
      await API.stopGame();
    } catch (err) {
      toast.error('Erro ao parar', err.message);
    } finally {
      setPlaying(false);
      btnStop.disabled = false;
    }
  };
}

// Pasta do jogo
const btnGameDir = document.getElementById('btnGameDir');
if (btnGameDir) btnGameDir.onclick = () => API.openGameDir();

// Crash report
const btnCrash = document.getElementById('btnCrash');
if (btnCrash) {
  btnCrash.onclick = async () => {
    const logEl = document.getElementById('log');
    const crash = await API.lastCrash();
    if (logEl) {
      logEl.textContent += `\n--- ${crash.file || 'crash'} ---\n${crash.head}\n`;
      logEl.scrollTop = logEl.scrollHeight;
    }
  };
}

// Atualização manual
const btnUpdate = document.getElementById('btnUpdate');
if (btnUpdate) btnUpdate.onclick = () => API.checkUpdate();

// Reiniciar e atualizar
const btnRestart = document.getElementById('btnRestart');
if (btnRestart) btnRestart.onclick = () => API.installUpdate();

// Helper $
function $(id) { return document.getElementById(id); }

// Expor para debug
window.ObsidianApp = { state, navigateTo, API, toast };

// Global Search (Cmd/Ctrl+K)
function setupGlobalSearch() {
  const modalHtml = `
    <div class="modal-overlay" id="globalSearchModal" role="dialog" aria-modal="true" aria-label="Busca global">
      <div class="modal" style="max-width: 640px;">
        <div class="modal-header">
          <h3 class="modal-title">Busca Global <span class="muted" style="font-size:12px;font-weight:400;margin-left:8px;">⌘K</span></h3>
          <button class="modal-close" aria-label="Fechar">✕</button>
        </div>
        <div class="modal-body">
          <div class="search-wrapper" style="margin-bottom:16px;">
            <input type="text" id="globalSearchInput" placeholder="Buscar mods, shaders, packs, modpacks, amigos, configurações..." autocomplete="off" spellcheck="false">
            <button class="search-clear" aria-label="Limpar">✕</button>
          </div>
          <div id="globalSearchResults" style="max-height: 400px; overflow: auto;"></div>
        </div>
      </div>
    </div>
  `;
  
  document.body.insertAdjacentHTML('beforeend', modalHtml);
  
  const modal = document.getElementById('globalSearchModal');
  const input = document.getElementById('globalSearchInput');
  const resultsEl = document.getElementById('globalSearchResults');
  const closeBtn = modal.querySelector('.modal-close');
  const clearBtn = modal.querySelector('.search-clear');
  
  let searchAbort = null;
  let searchCache = new Map();
  
  function openModal() {
    modal.classList.add('open');
    input.focus();
    input.value = '';
    resultsEl.innerHTML = '';
    clearBtn.style.display = 'none';
    document.body.style.overflow = 'hidden';
  }
  
  function closeModal() {
    modal.classList.remove('open');
    document.body.style.overflow = '';
    if (searchAbort) searchAbort.abort();
  }
  
  closeBtn.onclick = closeModal;
  modal.onclick = (e) => { if (e.target === modal) closeModal(); };
  clearBtn.onclick = () => { input.value = ''; resultsEl.innerHTML = ''; clearBtn.style.display = 'none'; input.focus(); };
  
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (modal.classList.contains('open')) closeModal();
      else openModal();
    }
    if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  });
  
  input.addEventListener('input', debounce(async (e) => {
    const query = e.target.value.trim();
    clearBtn.style.display = query ? 'block' : 'none';
    
    if (query.length < 2) {
      resultsEl.innerHTML = '<div class="muted" style="padding:20px;text-align:center;">Digite 2+ caracteres para buscar</div>';
      return;
    }
    
    if (searchCache.has(query)) {
      renderGlobalResults(searchCache.get(query));
      return;
    }
    
    if (searchAbort) searchAbort.abort();
    searchAbort = new AbortController();
    
    resultsEl.innerHTML = '<div class="muted" style="padding:20px;text-align:center;">Buscando...</div>';
    
    try {
      const version = document.getElementById('version')?.value || '26.3';
      const loader = document.getElementById('loader')?.value || 'fabric';
      
      // Busca paralela em múltiplos tipos
      const [mods, shaders, packs, modpacks] = await Promise.allSettled([
        API.searchModrinth(query, loader, version, 'mod').catch(() => ({ hits: [] })),
        API.searchModrinth(query, loader, version, 'shader').catch(() => ({ hits: [] })),
        API.searchModrinth(query, loader, version, 'resourcepack').catch(() => ({ hits: [] })),
        API.searchModrinth(query, loader, version, 'modpack').catch(() => ({ hits: [] }))
      ]);
      
      const results = {
        mods: mods.value?.hits || [],
        shaders: shaders.value?.hits || [],
        packs: packs.value?.hits || [],
        modpacks: modpacks.value?.hits || []
      };
      
      searchCache.set(query, results);
      renderGlobalResults(results);
    } catch (err) {
      if (err.name !== 'AbortError') {
        resultsEl.innerHTML = `<div class="muted" style="padding:20px;text-align:center;">Erro: ${err.message}</div>`;
      }
    }
  }, 200));
  
  function renderGlobalResults(results) {
    const sections = [];
    
    if (results.mods.length) {
      sections.push(`
        <div style="margin-bottom: 16px;">
          <h4 style="margin:0 0 8px;color:var(--acc3);font-size:13px;text-transform:uppercase;letter-spacing:1px;">Mods (${results.mods.length})</h4>
          ${results.mods.slice(0, 5).map(m => globalResultItem(m, 'mod')).join('')}
        </div>
      `);
    }
    if (results.shaders.length) {
      sections.push(`
        <div style="margin-bottom: 16px;">
          <h4 style="margin:0 0 8px;color:var(--acc3);font-size:13px;text-transform:uppercase;letter-spacing:1px;">Shaders (${results.shaders.length})</h4>
          ${results.shaders.slice(0, 5).map(m => globalResultItem(m, 'shader')).join('')}
        </div>
      `);
    }
    if (results.packs.length) {
      sections.push(`
        <div style="margin-bottom: 16px;">
          <h4 style="margin:0 0 8px;color:var(--acc3);font-size:13px;text-transform:uppercase;letter-spacing:1px;">Resource Packs (${results.packs.length})</h4>
          ${results.packs.slice(0, 5).map(m => globalResultItem(m, 'resourcepack')).join('')}
        </div>
      `);
    }
    if (results.modpacks.length) {
      sections.push(`
        <div>
          <h4 style="margin:0 0 8px;color:var(--acc3);font-size:13px;text-transform:uppercase;letter-spacing:1px;">Modpacks (${results.modpacks.length})</h4>
          ${results.modpacks.slice(0, 5).map(m => globalResultItem(m, 'modpack')).join('')}
        </div>
      `);
    }
    
    if (!sections.length) {
      resultsEl.innerHTML = '<div class="muted" style="padding:20px;text-align:center;">Nenhum resultado</div>';
      return;
    }
    
    resultsEl.innerHTML = sections.join('');
    
    // Bind click handlers
    resultsEl.querySelectorAll('[data-global-download]').forEach(btn => {
      btn.onclick = async () => {
        const { pid, kind } = btn.dataset;
        btn.disabled = true;
        btn.textContent = 'Baixando...';
        try {
          const version = document.getElementById('version')?.value || '26.3';
          const loader = document.getElementById('loader')?.value || 'fabric';
          
          if (kind === 'mod') {
            await API.modDownload(pid, loader, version);
          } else {
            await API.contentDownload(kind, pid, loader, version);
          }
          toast.success(`${kind} instalado`, pid);
          closeModal();
        } catch (err) {
          btn.disabled = false;
          btn.textContent = 'Erro';
          toast.error('Download falhou', err.message);
        }
      };
    });
  }
  
  function globalResultItem(item, kind) {
    const icons = { mod: '🧩', shader: '✨', resourcepack: '🎨', modpack: '📦' };
    return `
      <button class="mod" style="width:100%;text-align:left;padding:10px 12px;background:transparent;border:1px solid var(--line);" data-global-download data-pid="${escapeHtml(item.project_id)}" data-kind="${kind}">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:18px;">${icons[kind]}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(item.title)}</div>
            <div class="muted" style="font-size:11px;">${kind} • ${(item.downloads || 0).toLocaleString()} downloads</div>
          </div>
          <span class="chip">${kind}</span>
        </div>
      </button>
    `;
  }
  
  }

// Sidebar Collapsible
function setupSidebarToggle() {
  const sidebar = document.querySelector('.sidebar');
  const app = document.querySelector('.app');
  
  if (!sidebar || !app) return;
  
  // Create toggle button
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'sidebar-toggle';
  toggleBtn.innerHTML = '◀';
  toggleBtn.style.cssText = `
    position: absolute;
    right: -14px;
    top: 50%;
    transform: translateY(-50%);
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--panel2);
    border: 1px solid var(--line);
    color: var(--txt);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    box-shadow: var(--shadow-md);
    z-index: 10;
    transition: all var(--transition-fast);
  `;
  toggleBtn.setAttribute('aria-label', 'Colapsar/Expandir sidebar');
  toggleBtn.setAttribute('title', 'Colapsar sidebar (Ctrl+B)');
  
  sidebar.style.position = 'relative';
  sidebar.appendChild(toggleBtn);
  
  let collapsed = false;
  
  function toggle() {
    collapsed = !collapsed;
    sidebar.classList.toggle('collapsed', collapsed);
    toggleBtn.innerHTML = collapsed ? '▶' : '◀';
    toggleBtn.setAttribute('aria-label', collapsed ? 'Expandir sidebar' : 'Colapsar sidebar');
    toggleBtn.setAttribute('title', collapsed ? 'Expandir sidebar (Ctrl+B)' : 'Colapsar sidebar (Ctrl+B)');
    
    // Persist state
    try {
      const settings = JSON.parse(localStorage.getItem('obsidian-sidebar') || '{}');
      settings.collapsed = collapsed;
      localStorage.setItem('obsidian-sidebar', JSON.stringify(settings));
    } catch {}
  }
  
  toggleBtn.onclick = toggle;
  
  // Restore state
  try {
    const settings = JSON.parse(localStorage.getItem('obsidian-sidebar') || '{}');
    if (settings.collapsed) {
      collapsed = true;
      sidebar.classList.add('collapsed');
      toggleBtn.innerHTML = '▶';
    }
  } catch {}
  
  // Keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      toggle();
    }
  });
  
  // Add CSS for collapsed state
  const style = document.createElement('style');
  style.textContent = `
    .sidebar.collapsed {
      width: 64px !important;
      padding: 16px 8px !important;
    }
    .sidebar.collapsed .logo div,
    .sidebar.collapsed .nav span,
    .sidebar.collapsed .user,
    .sidebar.collapsed .acc-row,
    .sidebar.collapsed #updStatus {
      display: none !important;
    }
    .sidebar.collapsed .logo { justify-content: center; }
    .sidebar.collapsed .nav { align-items: center; }
    .sidebar.collapsed .nav { padding: 10px; }
    .sidebar.collapsed .account { padding: 10px 8px; }
    .sidebar.collapsed .sidebar-toggle { right: -14px; }
    @media (max-width: 900px) {
      .sidebar.collapsed { width: 100% !important; padding: 12px !important; }
      .sidebar.collapsed .logo div,
      .sidebar.collapsed .nav span,
      .sidebar.collapsed .user,
      .sidebar.collapsed .acc-row,
      .sidebar.collapsed #updStatus { display: block !important; }
      .sidebar.collapsed .logo { justify-content: flex-start; }
      .sidebar.collapsed .nav { flex-direction: row; }
      .sidebar.collapsed .nav { padding: 8px 12px; }
    }
  `;
  document.head.appendChild(style);
}

// Initialize enhancements after DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
  });
} else {
  init();
}

export { init, navigateTo, state, API, toast };