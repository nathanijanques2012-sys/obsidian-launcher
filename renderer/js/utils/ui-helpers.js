/**
 * UI Helpers - Funções compartilhadas para manipulação de DOM
 */

/**
 * Escape HTML para prevenir XSS
 */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

/**
 * Popula o select de versões
 */
export function populateVersionSelect(versions, currentVersion = null) {
  const select = document.getElementById('version');
  if (!select) return;
  // Preserva a escolha atual ao reconstruir as opções (era isso que resetava)
  const keep = currentVersion || select.value;
  select.innerHTML = versions.map(v =>
    `<option value="${v}" ${v === keep ? 'selected' : ''}>${v}</option>`
  ).join('');
  if (keep && versions.includes(keep)) select.value = keep;
}

/**
 * Atualiza labels de contexto (versão + loader)
 */
export function updateContextLabels(settings) {
  const label = `${settings?.loader || 'fabric'} • ${settings?.version || '26.3'}`;
  ['modsCtx', 'shadersCtx', 'packsCtx', 'modpacksCtx'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = label;
  });
}

/**
 * Atualiza UI da conta
 */
export function updateAccountUI(account) {
  const userEl = document.getElementById('user');
  if (userEl) userEl.textContent = account ? `${account.name} (${account.type})` : 'Não logado';
}

/**
 * Configura UI com settings
 */
export function applySettingsToUI(settings) {
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
    const value = path.split('.').reduce((o, k) => o?.[k], settings);
    if (value !== undefined) {
      if (el.type === 'checkbox') el.checked = value;
      else el.value = value;
    }
  });
}

export function showToast(type, title, message, options = {}) {
  if (window.toast) {
    window.toast[type](title, message, options);
  }
}

export default {
  populateVersionSelect,
  updateContextLabels,
  updateAccountUI,
  applySettingsToUI,
  escapeHtml,
  showToast
};