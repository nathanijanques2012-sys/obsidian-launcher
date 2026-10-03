/**
 * Page: Play (Jogar) - Dashboard Rica
 * Tela principal com cards de resumo, últimas jogadas, stats, amigos online
 */

import { API } from '../utils/api.js';
import { toast } from '../utils/toast.js';
import { VirtualList } from '../components/VirtualList.js';
import { createModSkeleton, createFriendSkeleton, createListSkeletonLines, showSkeleton, hideSkeleton } from '../components/Skeleton.js';
import { populateVersionSelect, updateContextLabels, updateAccountUI, escapeHtml } from '../utils/ui-helpers.js';

let statsVirtualList = null;
let friendsVirtualList = null;
let pageState = null;

export async function init({ state, API, toast, VirtualList, Skeleton }) {
  pageState = state;
  setupButtons();
  setupVersionLoaderSync();
  setupProfileSelector();
  
  // Carrega dados do dashboard
  await loadDashboardData();
}

export async function render() {
  await loadDashboardData();
  updateContextLabels();
}

async function loadDashboardData() {
  try {
    // Carrega em paralelo
    const [account, versions, modsList, friendsList, settings] = await Promise.allSettled([
      API.getAccount(),
      API.getVersions(),
      API.modsList(),
      API.friendsList(),
      API.getSettings()
    ]);
    
    pageState.account = account.status === 'fulfilled' ? account.value : null;
    pageState.versions = versions.status === 'fulfilled' ? versions.value : ['1.21', '1.20.4', '1.19.4'];
    pageState.settings = settings.status === 'fulfilled' ? settings.value : { ramMin: '2G', ramMax: '4G', javaPath: '', gameDir: '', resolution: { width: 854, height: 480 }, version: '26.3', loader: 'fabric', autoUpdate: true, overlay: true, displayMode: 'window', softwareGL: false };
    
    updateAccountUI(pageState.account);
    populateVersionSelect(pageState.versions, pageState.settings?.version);
    updateContextLabels();
    
    // Renderiza cards do dashboard
    renderStatsCard(modsList.status === 'fulfilled' ? modsList.value : []);
    renderFriendsCard(friendsList.status === 'fulfilled' ? friendsList.value : []);
    renderRecentActivity();
    renderQuickActions();
    
  } catch (err) {
    console.error('[Dashboard] Erro ao carregar:', err);
  }
}

function setupButtons() {
  const versionSel = document.getElementById('version');
  const loaderSel = document.getElementById('loader');

  if (versionSel) versionSel.addEventListener('change', () => {
    updateContextLabels();
    saveLastProfile();
    persistVersionLoader();
  });
  if (loaderSel) loaderSel.addEventListener('change', () => {
    updateContextLabels();
    saveLastProfile();
    persistVersionLoader();
  });
}

// A escolha do Jogar vale na hora e é salva: nada mais reseta ao trocar de
// aba, e o resto (mods, skins, launch) sempre enxerga o valor atual.
function persistVersionLoader() {
  const v = document.getElementById('version').value;
  const l = document.getElementById('loader').value;
  if (pageState.settings) { pageState.settings.version = v; pageState.settings.loader = l; }
  API.saveSettings({ version: v, loader: l }).catch(() => {});
}

function setupVersionLoaderSync() {
  const versionSel = document.getElementById('version');
  const loaderSel = document.getElementById('loader');
  
  if (versionSel && pageState.settings) {
    versionSel.value = pageState.settings.version || '26.3';
  }
  if (loaderSel && pageState.settings) {
    loaderSel.value = pageState.settings.loader || 'fabric';
  }
}

function setupProfileSelector() {
  const profileSelect = document.getElementById('profileSelect');
  if (!profileSelect) return;
  
  loadProfiles().then(profiles => {
    const currentProfile = pageState.settings?.lastProfile || 'default';
    profileSelect.innerHTML = profiles.map(p => 
      `<option value="${p.id}" ${p.id === currentProfile ? 'selected' : ''}>${p.name}</option>`
    ).join('');
    
    // Adiciona opção de novo perfil
    profileSelect.insertAdjacentHTML('beforeend', '<option value="__new__">+ Novo Perfil...</option>');
  });
  
  profileSelect.addEventListener('change', async (e) => {
    if (e.target.value === '__new__') {
      await createNewProfile();
      e.target.value = pageState.settings?.lastProfile || 'default';
    } else {
      await loadProfile(e.target.value);
    }
  });
}

async function loadProfiles() {
  try {
    const data = localStorage.getItem('obsidian-profiles');
    return data ? JSON.parse(data) : [{ id: 'default', name: 'Padrão', version: '26.3', loader: 'fabric', mods: [] }];
  } catch {
    return [{ id: 'default', name: 'Padrão', version: '26.3', loader: 'fabric', mods: [] }];
  }
}

async function saveProfiles(profiles) {
  localStorage.setItem('obsidian-profiles', JSON.stringify(profiles));
}

async function createNewProfile() {
  const name = prompt('Nome do novo perfil:', 'Meu Perfil');
  if (!name) return;
  
  const profiles = await loadProfiles();
  const id = 'profile_' + Date.now();
  const newProfile = {
    id,
    name,
    version: document.getElementById('version').value,
    loader: document.getElementById('loader').value,
    ramMin: document.getElementById('ramMin').value,
    ramMax: document.getElementById('ramMax').value,
    displayMode: document.getElementById('displayMode').value,
    softwareGL: document.getElementById('softwareGL').checked,
    overlay: document.getElementById('overlay').checked,
    mods: [],
    createdAt: Date.now()
  };
  
  profiles.push(newProfile);
  await saveProfiles(profiles);
  
  const profileSelect = document.getElementById('profileSelect');
  if (profileSelect) {
    profileSelect.innerHTML = profiles.map(p => 
      `<option value="${p.id}" ${p.id === id ? 'selected' : ''}>${p.name}</option>`
    ).join('');
    profileSelect.insertAdjacentHTML('beforeend', '<option value="__new__">+ Novo Perfil...</option>');
    profileSelect.value = id;
  }
  
  await loadProfile(id);
  toast.success('Perfil criado', name);
}

async function loadProfile(profileId) {
  const profiles = await loadProfiles();
  const profile = profiles.find(p => p.id === profileId);
  if (!profile) return;
  
  // Aplica configurações do perfil
  document.getElementById('version').value = profile.version;
  document.getElementById('loader').value = profile.loader;
  document.getElementById('ramMin').value = profile.ramMin || '2G';
  document.getElementById('ramMax').value = profile.ramMax || '4G';
  document.getElementById('displayMode').value = profile.displayMode || 'window';
  document.getElementById('softwareGL').checked = profile.softwareGL || false;
  document.getElementById('overlay').checked = profile.overlay !== false;
  
  // Salva como último perfil usado
  pageState.settings = { ...pageState.settings, lastProfile: profileId };
  await API.saveSettings({ lastProfile: profileId });
  persistVersionLoader();

  updateContextLabels();
  toast.info('Perfil carregado', profile.name);
}

async function saveLastProfile() {
  const profileId = pageState.settings?.lastProfile || 'default';
  const profiles = await loadProfiles();
  const profile = profiles.find(p => p.id === profileId);
  
  if (profile) {
    profile.version = document.getElementById('version').value;
    profile.loader = document.getElementById('loader').value;
    profile.ramMin = document.getElementById('ramMin').value;
    profile.ramMax = document.getElementById('ramMax').value;
    profile.displayMode = document.getElementById('displayMode').value;
    profile.softwareGL = document.getElementById('softwareGL').checked;
    profile.overlay = document.getElementById('overlay').checked;
    profile.lastUsed = Date.now();
    await saveProfiles(profiles);
  }
}

function renderStatsCard(mods) {
  const container = document.getElementById('dashboardStats');
  if (!container) return;
  
  const totalMods = mods.length;
  const totalSize = mods.reduce((sum, m) => sum + m.size, 0);
  const lastPlayed = localStorage.getItem('obsidian-lastPlayed') || 'Nunca';
  const playCount = parseInt(localStorage.getItem('obsidian-playCount') || '0');
  
  container.innerHTML = `
    <div class="stat-grid">
      <div class="stat-card">
        <span class="stat-icon">🧩</span>
        <div class="stat-info">
          <span class="stat-value">${totalMods}</span>
          <span class="stat-label">Mods Instalados</span>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon">💾</span>
        <div class="stat-info">
          <span class="stat-value">${(totalSize / 1024 / 1024).toFixed(1)} MB</span>
          <span class="stat-label">Espaço Usado</span>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon">🎮</span>
        <div class="stat-info">
          <span class="stat-value">${playCount}</span>
          <span class="stat-label">Vezes Jogadas</span>
        </div>
      </div>
      <div class="stat-card">
        <span class="stat-icon">🕐</span>
        <div class="stat-info">
          <span class="stat-value" style="font-size: 14px;">${lastPlayed}</span>
          <span class="stat-label">Última Vez</span>
        </div>
      </div>
    </div>
  `;
}

function renderFriendsCard(friends) {
  const container = document.getElementById('dashboardFriends');
  if (!container) return;
  
  // Filtra apenas amigos online
  const onlineFriends = friends.filter(f => f.online); // Será populado pelo ping
  
  // Mostra todos com skeleton de status
  container.innerHTML = friends.slice(0, 5).map(f => `
    <div class="friend-card" data-nick="${escapeHtml(f.nick)}">
      <div class="friend-avatar">${escapeHtml(f.nick[0]).toUpperCase()}</div>
      <div class="friend-info">
        <span class="friend-name">${escapeHtml(f.nick)}</span>
        <span class="friend-status muted" id="fs-${escapeHtml(f.nick)}">Verificando...</span>
      </div>
      <button class="ghost btn-join" data-address="${escapeHtml(f.address)}" style="font-size:11px;padding:4px 8px;" title="Copiar IP e entrar">Entrar</button>
    </div>
  `).join('') || '<div class="muted" style="text-align:center;padding:20px;">Nenhum amigo adicionado</div>';
  
  // Ping servers
  friends.forEach(f => {
    API.friendPing(f.address).then(r => {
      const statusEl = document.getElementById(`fs-${f.nick}`);
      if (statusEl) {
        if (r.online) {
          statusEl.textContent = `🟢 ${r.players} • ${r.ms}ms`;
          statusEl.style.color = 'var(--success)';
        } else {
          statusEl.textContent = '🔴 Offline';
          statusEl.style.color = 'var(--error)';
        }
      }
    }).catch(() => {
      const statusEl = document.getElementById(`fs-${f.nick}`);
      if (statusEl) {
        statusEl.textContent = '🔴 Erro';
        statusEl.style.color = 'var(--error)';
      }
    });
  });
  
  // Bind join buttons
  container.querySelectorAll('.btn-join').forEach(btn => {
    btn.onclick = () => {
      navigator.clipboard.writeText(btn.dataset.address);
      toast.success('IP copiado', `${btn.dataset.address} - Cole no jogo (Direct Connect)`);
    };
  });
}

function renderRecentActivity() {
  const container = document.getElementById('dashboardActivity');
  if (!container) return;
  
  const activities = JSON.parse(localStorage.getItem('obsidian-activities') || '[]');
  
  container.innerHTML = activities.slice(0, 5).map(a => `
    <div class="activity-item">
      <span class="activity-icon">${a.icon}</span>
      <div class="activity-info">
        <span class="activity-title">${escapeHtml(a.title)}</span>
        <span class="activity-time muted">${a.time}</span>
      </div>
    </div>
  `).join('') || '<div class="muted" style="text-align:center;padding:20px;">Nenhuma atividade recente</div>';
}

function renderQuickActions() {
  const container = document.getElementById('dashboardActions');
  if (!container) return;
  
  const hasAccount = !!pageState.account;
  const hasMods = false; // Será verificado
  
  container.innerHTML = `
    <div class="action-grid">
      <button class="action-btn primary" id="quickPlay" ${!hasAccount ? 'disabled' : ''}>
        <span class="action-icon">▶</span>
        <span>Jogar Agora</span>
      </button>
      <button class="action-btn" id="quickMods">
        <span class="action-icon">🧩</span>
        <span>Gerenciar Mods</span>
      </button>
      <button class="action-btn" id="quickShaders">
        <span class="action-icon">✨</span>
        <span>Shaders</span>
      </button>
      <button class="action-btn" id="quickFolder">
        <span class="action-icon">📁</span>
        <span>Abrir Pasta</span>
      </button>
      <button class="action-btn" id="quickSettings">
        <span class="action-icon">⚙</span>
        <span>Configurações</span>
      </button>
      <button class="action-btn" id="quickProfile">
        <span class="action-icon">👤</span>
        <span>Perfis</span>
      </button>
    </div>
  `;
  
  // Bind actions
  const quickPlay = document.getElementById('quickPlay');
  if (quickPlay) quickPlay.onclick = () => document.getElementById('btnPlay')?.click();
  
  const quickMods = document.getElementById('quickMods');
  if (quickMods) quickMods.onclick = () => navigateTo('mods');
  
  const quickShaders = document.getElementById('quickShaders');
  if (quickShaders) quickShaders.onclick = () => navigateTo('shaders');
  
  const quickFolder = document.getElementById('quickFolder');
  if (quickFolder) quickFolder.onclick = () => API.openGameDir();
  
  const quickSettings = document.getElementById('quickSettings');
  if (quickSettings) quickSettings.onclick = () => navigateTo('config');
  
  const quickProfile = document.getElementById('quickProfile');
  if (quickProfile) quickProfile.onclick = () => document.getElementById('profileSelect')?.focus();
}





// Track play activity
window.addEventListener('game-started', () => {
  const count = parseInt(localStorage.getItem('obsidian-playCount') || '0') + 1;
  localStorage.setItem('obsidian-playCount', count);
  localStorage.setItem('obsidian-lastPlayed', new Date().toLocaleString('pt-BR'));
  
  const activities = JSON.parse(localStorage.getItem('obsidian-activities') || '[]');
  activities.unshift({
    icon: '▶',
    title: `Iniciou Minecraft ${pageState.settings?.version} (${pageState.settings?.loader})`,
    time: new Date().toLocaleString('pt-BR')
  });
  localStorage.setItem('obsidian-activities', JSON.stringify(activities.slice(0, 50)));
});

function navigateTo(page) {
  if (window.ObsidianApp?.navigateTo) {
    window.ObsidianApp.navigateTo(page);
  }
}

export default { init, render };