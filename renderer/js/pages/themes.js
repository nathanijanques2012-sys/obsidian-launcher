/**
 * Page: Themes/Tema
 * Customização visual: accent color, background, import/export
 */

import { API } from '../utils/api.js';
import { toast } from '../utils/toast.js';

const PRESET_THEMES = [
  { id: 'obsidian', name: 'Obsidian (Padrão)', primary: '#a855f7', secondary: '#7c3aed', bg: 'radial-gradient(1200px 600px at 70% -10%, #2b1650, #0d0716)' },
  { id: 'emerald', name: 'Esmeralda', primary: '#10b981', secondary: '#059669', bg: 'radial-gradient(1200px 600px at 70% -10%, #064e3b, #022c22)' },
  { id: 'amber', name: 'Âmbar', primary: '#f59e0b', secondary: '#d97706', bg: 'radial-gradient(1200px 600px at 70% -10%, #78350f, #1c1917)' },
  { id: 'rose', name: 'Rosa', primary: '#f43f5e', secondary: '#e11d48', bg: 'radial-gradient(1200px 600px at 70% -10%, #881337, #1c1917)' },
  { id: 'blue', name: 'Azul', primary: '#3b82f6', secondary: '#2563eb', bg: 'radial-gradient(1200px 600px at 70% -10%, #1e3a5f, #0f172a)' },
  { id: 'cyan', name: 'Ciano', primary: '#06b6d4', secondary: '#0891b2', bg: 'radial-gradient(1200px 600px at 70% -10%, #155e75, #0f172a)' },
  { id: 'violet', name: 'Violeta', primary: '#8b5cf6', secondary: '#7c3aed', bg: 'radial-gradient(1200px 600px at 70% -10%, #3b1470, #0d0716)' },
  { id: 'monochrome', name: 'Monocromático', primary: '#a1a1aa', secondary: '#71717a', bg: 'radial-gradient(1200px 600px at 70% -10%, #27272a, #09090b)' },
];

let currentCustomTheme = null;

export async function init({ state, API, toast }) {
  setupColorPickers();
  setupBackgroundOptions();
  setupPresetThemes();
  setupImportExport();
  loadSavedTheme();
}

export async function render() {
  loadSavedTheme();
}

function setupColorPickers() {
  const primaryInput = document.getElementById('themePrimary');
  const secondaryInput = document.getElementById('themeSecondary');
  
  if (primaryInput) {
    primaryInput.addEventListener('input', debounce(() => applyCustomTheme(), 100));
  }
  if (secondaryInput) {
    secondaryInput.addEventListener('input', debounce(() => applyCustomTheme(), 100));
  }
  
  // Botão reset
  const btnReset = document.getElementById('btnResetTheme');
  if (btnReset) btnReset.onclick = resetToDefault;
  
  // Botão salvar custom
  const btnSaveCustom = document.getElementById('btnSaveCustomTheme');
  if (btnSaveCustom) btnSaveCustom.onclick = saveCustomTheme;
}

function setupBackgroundOptions() {
  const bgType = document.getElementById('bgType');
  const bgCustom = document.getElementById('bgCustom');
  const bgImageInput = document.getElementById('bgImageInput');
  const bgImagePreview = document.getElementById('bgImagePreview');
  
  if (bgType) {
    bgType.addEventListener('change', () => {
      if (bgCustom) bgCustom.style.display = bgType.value === 'custom' ? 'block' : 'none';
      if (bgType.value !== 'custom') applyBackground(bgType.value);
    });
  }
  
  if (bgImageInput) {
    bgImageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const url = ev.target.result;
          if (bgImagePreview) {
            bgImagePreview.style.backgroundImage = `url(${url})`;
            bgImagePreview.style.display = 'block';
          }
          applyCustomBackground(url);
        };
        reader.readAsDataURL(file);
      }
    });
  }
  
  // Opacidade do background
  const bgOpacity = document.getElementById('bgOpacity');
  const bgOpacityVal = document.getElementById('bgOpacityVal');
  if (bgOpacity) {
    bgOpacity.addEventListener('input', debounce(() => {
      document.documentElement.style.setProperty('--bg-overlay-opacity', bgOpacity.value / 100);
      saveThemeSetting('bgOpacity', bgOpacity.value);
      if (bgOpacityVal) bgOpacityVal.textContent = bgOpacity.value;
    }, 100));
  }
  
  // Blur do background
  const bgBlur = document.getElementById('bgBlur');
  const bgBlurVal = document.getElementById('bgBlurVal');
  if (bgBlur) {
    bgBlur.addEventListener('input', debounce(() => {
      document.documentElement.style.setProperty('--bg-blur', bgBlur.value + 'px');
      saveThemeSetting('bgBlur', bgBlur.value);
      if (bgBlurVal) bgBlurVal.textContent = bgBlur.value;
    }, 100));
  }
}

function setupPresetThemes() {
  const container = document.getElementById('presetThemes');
  if (!container) return;
  
  container.innerHTML = PRESET_THEMES.map(theme => `
    <button class="preset-theme${theme.id === 'obsidian' ? ' active' : ''}" 
            data-theme="${theme.id}" 
            style="--theme-primary: ${theme.primary}; --theme-secondary: ${theme.secondary};"
            title="${theme.name}">
      <span class="preset-preview" style="background: linear-gradient(135deg, ${theme.primary}, ${theme.secondary});"></span>
      <span class="preset-name">${theme.name}</span>
    </button>
  `).join('');
  
  container.querySelectorAll('.preset-theme').forEach(btn => {
    btn.onclick = () => applyPresetTheme(btn.dataset.theme);
  });
}

function setupImportExport() {
  const btnExport = document.getElementById('btnExportTheme');
  const btnImport = document.getElementById('btnImportTheme');
  const importFile = document.getElementById('importThemeFile');
  
  if (btnExport) {
    btnExport.onclick = exportTheme;
  }
  
  if (btnImport) {
    btnImport.onclick = () => importFile?.click();
  }
  
  if (importFile) {
    importFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          try {
            const theme = JSON.parse(ev.target.result);
            importTheme(theme);
          } catch (err) {
            toast.error('Importação falhou', 'Arquivo JSON inválido');
          }
        };
        reader.readAsText(file);
      }
      importFile.value = '';
    });
  }
}

function applyPresetTheme(themeId) {
  const theme = PRESET_THEMES.find(t => t.id === themeId);
  if (!theme) return;
  
  applyThemeVariables(theme);
  saveThemeSetting('preset', themeId);
  saveThemeSetting('custom', null);
  
  // Update UI
  document.querySelectorAll('.preset-theme').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === themeId);
  });
  
  // Reset custom inputs
  const primaryInput = document.getElementById('themePrimary');
  const secondaryInput = document.getElementById('themeSecondary');
  if (primaryInput) primaryInput.value = theme.primary;
  if (secondaryInput) secondaryInput.value = theme.secondary;
  
  const bgType = document.getElementById('bgType');
  if (bgType) bgType.value = 'gradient';
  
  toast.success('Tema aplicado', theme.name);
}

function applyCustomTheme() {
  const primary = document.getElementById('themePrimary')?.value || '#a855f7';
  const secondary = document.getElementById('themeSecondary')?.value || '#7c3aed';
  
  const customTheme = {
    id: 'custom',
    name: 'Personalizado',
    primary,
    secondary,
    bg: getCurrentBackground()
  };
  
  applyThemeVariables(customTheme);
  saveThemeSetting('custom', customTheme);
  saveThemeSetting('preset', null);
  
  // Update preset buttons
  document.querySelectorAll('.preset-theme').forEach(btn => btn.classList.remove('active'));
  
  currentCustomTheme = customTheme;
}

function applyThemeVariables(theme) {
  const root = document.documentElement;
  
  // Primary colors
  root.style.setProperty('--acc', theme.primary);
  root.style.setProperty('--acc2', theme.secondary);
  
  // Calculate accent3 (lighter version)
  const acc3 = lightenColor(theme.primary, 30);
  root.style.setProperty('--acc3', acc3);
  
  // Calculate panel colors based on primary
  const panel = darkenColor(theme.primary, 85);
  const panel2 = darkenColor(theme.primary, 80);
  const line = darkenColor(theme.primary, 60);
  const deep = darkenColor(theme.primary, 90);
  
  root.style.setProperty('--panel', panel);
  root.style.setProperty('--panel2', panel2);
  root.style.setProperty('--line', line);
  root.style.setProperty('--deep', deep);
  
  // Update scrollbar
  root.style.setProperty('--scrollbar-thumb', `linear-gradient(180deg,${acc3},${theme.secondary})`);
  
  // Apply background
  if (theme.bg) {
    document.body.style.background = theme.bg;
  }
}

function applyCustomBackground(imageUrl) {
  document.body.style.background = `url(${imageUrl}) center/cover no-repeat fixed`;
  document.documentElement.style.setProperty('--bg-overlay-opacity', '0.85');
  saveThemeSetting('bgImage', imageUrl);
  saveThemeSetting('bgType', 'image');
  
  const bgType = document.getElementById('bgType');
  if (bgType) bgType.value = 'custom';
}

function applyBackground(type) {
  const presets = {
    gradient: 'radial-gradient(1200px 600px at 70% -10%, #2b1650, #0d0716)',
    solid: '#0d0716',
    dark: '#050505'
  };
  
  if (presets[type]) {
    document.body.style.background = presets[type];
    saveThemeSetting('bgType', type);
    saveThemeSetting('bgImage', null);
  }
}

function getCurrentBackground() {
  return document.body.style.background || 'radial-gradient(1200px 600px at 70% -10%, #2b1650, #0d0716)';
}

function resetToDefault() {
  applyPresetTheme('obsidian');
  document.body.style.background = PRESET_THEMES[0].bg;
  toast.success('Tema resetado', 'Voltou ao padrão Obsidian');
}

function saveCustomTheme() {
  if (!currentCustomTheme) {
    applyCustomTheme();
  }
  toast.success('Tema personalizado salvo', 'Suas cores foram salvas');
}

function exportTheme() {
  const theme = {
    preset: localStorage.getItem('obsidian-theme-preset'),
    custom: localStorage.getItem('obsidian-theme-custom'),
    bgType: localStorage.getItem('obsidian-bg-type'),
    bgImage: localStorage.getItem('obsidian-bg-image'),
    bgOpacity: localStorage.getItem('obsidian-bg-opacity'),
    bgBlur: localStorage.getItem('obsidian-bg-blur'),
    exportedAt: new Date().toISOString(),
    version: '1.0'
  };
  
  const blob = new Blob([JSON.stringify(theme, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `obsidian-theme-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  
  toast.success('Tema exportado', 'Arquivo JSON baixado');
}

function importTheme(theme) {
  if (theme.custom) {
    applyThemeVariables(theme.custom);
    saveThemeSetting('custom', theme.custom);
    saveThemeSetting('preset', null);
    
    const primaryInput = document.getElementById('themePrimary');
    const secondaryInput = document.getElementById('themeSecondary');
    if (primaryInput) primaryInput.value = theme.custom.primary;
    if (secondaryInput) secondaryInput.value = theme.custom.secondary;
  }
  
  if (theme.preset) {
    saveThemeSetting('preset', theme.preset);
    document.querySelectorAll('.preset-theme').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === theme.preset);
    });
  }
  
  if (theme.bgType) {
    const bgType = document.getElementById('bgType');
    if (bgType) bgType.value = theme.bgType;
    saveThemeSetting('bgType', theme.bgType);
  }
  
  if (theme.bgImage && theme.bgType === 'custom') {
    applyCustomBackground(theme.bgImage);
  } else if (theme.bgType) {
    applyBackground(theme.bgType);
  }
  
  if (theme.bgOpacity) {
    document.documentElement.style.setProperty('--bg-overlay-opacity', theme.bgOpacity / 100);
    const bgOpacity = document.getElementById('bgOpacity');
    if (bgOpacity) bgOpacity.value = theme.bgOpacity;
    saveThemeSetting('bgOpacity', theme.bgOpacity);
  }
  
  if (theme.bgBlur) {
    document.documentElement.style.setProperty('--bg-blur', theme.bgBlur + 'px');
    const bgBlur = document.getElementById('bgBlur');
    if (bgBlur) bgBlur.value = theme.bgBlur;
    saveThemeSetting('bgBlur', theme.bgBlur);
  }
  
  toast.success('Tema importado', 'Configurações aplicadas');
}

function loadSavedTheme() {
  const preset = localStorage.getItem('obsidian-theme-preset');
  const custom = localStorage.getItem('obsidian-theme-custom');
  const bgType = localStorage.getItem('obsidian-bg-type') || 'gradient';
  const bgImage = localStorage.getItem('obsidian-bg-image');
  const bgOpacity = localStorage.getItem('obsidian-bg-opacity') || '85';
  const bgBlur = localStorage.getItem('obsidian-bg-blur') || '0';
  
  // Apply opacity/blur
  document.documentElement.style.setProperty('--bg-overlay-opacity', bgOpacity / 100);
  document.documentElement.style.setProperty('--bg-blur', bgBlur + 'px');
  
  const bgOpacityEl = document.getElementById('bgOpacity');
  const bgBlurEl = document.getElementById('bgBlur');
  if (bgOpacityEl) bgOpacityEl.value = bgOpacity;
  if (bgBlurEl) bgBlurEl.value = bgBlur;
  
  // Apply background
  const bgTypeEl = document.getElementById('bgType');
  if (bgTypeEl) bgTypeEl.value = bgType;
  
  if (bgType === 'custom' && bgImage) {
    const preview = document.getElementById('bgImagePreview');
    if (preview) {
      preview.style.backgroundImage = `url(${bgImage})`;
      preview.style.display = 'block';
    }
    document.body.style.background = `url(${bgImage}) center/cover no-repeat fixed`;
  } else {
    applyBackground(bgType);
  }
  
  // Apply theme
  if (custom) {
    try {
      const theme = JSON.parse(custom);
      applyThemeVariables(theme);
      currentCustomTheme = theme;
      
      const primaryInput = document.getElementById('themePrimary');
      const secondaryInput = document.getElementById('themeSecondary');
      if (primaryInput) primaryInput.value = theme.primary;
      if (secondaryInput) secondaryInput.value = theme.secondary;
      
      document.querySelectorAll('.preset-theme').forEach(btn => btn.classList.remove('active'));
    } catch {}
  } else if (preset) {
    applyPresetTheme(preset);
  }
}

function saveThemeSetting(key, value) {
  const prefix = 'obsidian-theme-';
  if (value === null || value === undefined) {
    localStorage.removeItem(prefix + key);
  } else {
    localStorage.setItem(prefix + key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  }
}

// Color utilities
function lightenColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
  const B = Math.min(255, (num & 0x0000FF) + amt);
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

function darkenColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
  const B = Math.max(0, (num & 0x0000FF) - amt);
  return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
}

function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export default { init, render };