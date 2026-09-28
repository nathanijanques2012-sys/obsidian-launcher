/**
 * Page: Mods
 * Busca e gerenciamento de mods via Modrinth
 */

import { API } from '../utils/api.js';
import { toast } from '../utils/toast.js';
import { VirtualList } from '../components/VirtualList.js';
import { createModSkeleton, createListSkeletonLines, showSkeleton, hideSkeleton } from '../components/Skeleton.js';
import { createSearchInput, debounce } from '../hooks/useDebounce.js';
import { escapeHtml } from '../utils/ui-helpers.js';

let virtualList = null;
let installedVirtualList = null;
let searchCleanup = null;

export async function init({ state, API, toast, VirtualList, Skeleton, debounce, createSearchInput }) {
  // Setup busca com debounce
  const modQuery = document.getElementById('modQuery');
  const modsContainer = document.getElementById('mods');
  
  if (modQuery && modsContainer) {
    searchCleanup = createSearchInput({
      input: modQuery,
      searchFn: async (query) => {
        const loader = document.getElementById('loader').value;
        const version = document.getElementById('version').value;
        const result = await API.searchModrinth(query, loader, version, 'mod');
        return result.hits || [];
      },
      onResults: (results) => renderModsResults(results, modsContainer),
      delay: 300,
      minLength: 2
    });
  }
  
  // Botões
  setupModButtons();
  
  // Inicializa virtual list para instalados
  initInstalledVirtualList();
}

export async function render() {
  // Atualiza lista de instalados
  await refreshModsList();
}

function setupModButtons() {
  // Buscar (fallback para click se não usar enter)
  const btnSearch = document.getElementById('btnSearch');
  if (btnSearch) {
    btnSearch.onclick = () => {
      const modQuery = document.getElementById('modQuery');
      if (modQuery) modQuery.dispatchEvent(new Event('input'));
    };
  }
  
  // Pasta mods
  const btnModsFolder = document.getElementById('btnModsFolder');
  if (btnModsFolder) btnModsFolder.onclick = () => API.openModsFolder();
  
  // Refresh instalados
  const btnModsRefresh = document.getElementById('btnModsRefresh');
  if (btnModsRefresh) btnModsRefresh.onclick = refreshModsList;
  
  // Overlay info
  const btnOverlayInfo = document.getElementById('btnOverlayInfo');
  if (btnOverlayInfo) {
    btnOverlayInfo.onclick = () => {
      toast.info('Como ativar Overlay Obsidian', 
        '1) Selecione loader Fabric + versão 1.21\n' +
        '2) Jogue 1x para criar pasta mods/\n' +
        '3) Build do obsidian-mod/ gera obsidian-overlay.jar\n' +
        '4) Copie p/ mods/ ou clique Abrir pasta\n' +
        '5) Jogue com Fabric. Aperte O no jogo p/ menu (FPS/coords/CPS)',
        { duration: 10000 }
      );
    };
  }
}

async function refreshModsList() {
  const container = document.getElementById('modsInstalled');
  const countEl = document.getElementById('modsCount');
  
  if (!container) return;
  
  // Skeleton enquanto carrega
  showSkeleton(container, createListSkeletonLines(5));
  
  try {
    const list = await API.modsList();
    if (countEl) countEl.textContent = list.length;

    // Recria sempre: o skeleton acima destrói o DOM interno do VirtualList
    // anterior (referências p/ nós removidos nunca mais aparecem).
    if (virtualList) { try { virtualList.destroy(); } catch {} virtualList = null; }
    virtualList = new VirtualList({
      container,
      items: list,
      itemHeight: 64,
      buffer: 3,
      renderItem: renderModInstalledItem,
      emptyMessage: 'Nenhum mod. Troque para Fabric e baixe Sodium p/ testar.'
    });
  } catch (err) {
    hideSkeleton(container, `<span class="muted">Erro: ${err.message}</span>`);
    toast.error('Erro ao listar mods', err.message);
  }
}

function initInstalledVirtualList() {
  const container = document.getElementById('modsInstalled');
  if (!container) return;
  
  virtualList = new VirtualList({
    container,
    items: [],
    itemHeight: 64,
    buffer: 3,
    renderItem: renderModInstalledItem,
    emptyMessage: 'Nenhum mod. Troque para Fabric e baixe Sodium p/ testar.'
  });
}

function renderModInstalledItem(mod, index) {
  return `
    <div class="mod" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px;">
      <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
        <div class="skeleton skeleton-avatar" style="width:40px;height:40px;background:linear-gradient(135deg,#3b2270,#5b21b6);flex-shrink:0;"></div>
        <div style="min-width:0;">
          <b style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;">${escapeHtml(mod.name)}</b>
          <span class="muted" style="font-size:12px;">${(mod.size / 1024).toFixed(0)} KB</span>
        </div>
      </div>
      <button class="ghost" data-del="${escapeHtml(mod.name)}" style="font-size:12px;padding:6px 10px;">Excluir</button>
    </div>
  `;
}

function renderModsResults(results, container) {
  if (!results || !results.length) {
    hideSkeleton(container, '<span class="muted">Nada encontrado</span>');
    return;
  }
  
  // Se tem error
  if (results.error) {
    hideSkeleton(container, `<span class="muted">Erro: ${escapeHtml(results.error)}</span>`);
    return;
  }
  
  const loader = document.getElementById('loader').value;
  const version = document.getElementById('version').value;
  
  const html = results.map(mod => {
    const loaders = (mod.categories || []).filter(c => ['fabric', 'forge', 'quilt', 'neoforge'].includes(c)).join('/');
    const supported = (mod.versions || []).join(', ');
    const label = `${loaders ? loaders + ' • ' : ''}MC ${version}`;
    
    return `
      <div class="mod" style="padding:12px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
          <div style="flex:1;min-width:0;">
            <b style="font-size:15px;">${escapeHtml(mod.title)}</b>
            <span class="chip" title="Suporta: ${escapeHtml(supported) || '?'}">${escapeHtml(label)}</span>
            <span class="muted" style="margin-left:8px;">⬇ ${mod.downloads || 0}</span>
            <div class="muted" style="margin-top:6px;max-height:40px;overflow:hidden;">${escapeHtml((mod.description || '').slice(0, 140))}</div>
          </div>
          <button class="dlx primary" data-pid="${escapeHtml(mod.project_id)}" data-kind="mod" style="flex-shrink:0;white-space:nowrap;">Baixar p/ ${escapeHtml(version)}</button>
        </div>
      </div>
    `;
  }).join('');
  
  hideSkeleton(container, html);
  
  // Bind download buttons
  container.querySelectorAll('.dlx').forEach(btn => {
    btn.onclick = async () => handleModDownload(btn);
  });
}

async function handleModDownload(btn) {
  const projectId = btn.dataset.pid;
  const loader = document.getElementById('loader').value;
  const version = document.getElementById('version').value;
  
  btn.disabled = true;
  btn.textContent = 'Baixando...';
  
  try {
    const res = await API.modDownload(projectId, loader, version);
    btn.textContent = (res.skipped ? 'Já instalado ✓ ' : 'Instalado ✓ ') + (res.file || '');
    if (res.version) btn.textContent += ` (v${res.version})`;
    
    toast.success(res.skipped ? 'Já instalado' : 'Mod instalado', res.file || '');
    await refreshModsList();
    
    // Refresh outras listas
    await Promise.allSettled([
      API.contentList('shader').then(r => updateInstalledList('shader', r)),
      API.contentList('resourcepack').then(r => updateInstalledList('resourcepack', r)),
      API.contentList('modpack').then(r => updateInstalledList('modpack', r))
    ]);
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Erro';
    toast.error('Download falhou', err.message);
  }
}

function updateInstalledList(kind, list) {
  const countEl = document.getElementById(`${kind}sCount`);
  const listEl = document.getElementById(`${kind}sInstalled`);
  if (countEl) countEl.textContent = list.length;
  if (listEl) {
    listEl.innerHTML = list.map(m => `
      <div class="mod">
        <b>${escapeHtml(m.name)}</b>
        <span class="muted">${kind === 'modpack' ? (m.size / 1024 / 1024).toFixed(1) + ' MB' : (m.size / 1024).toFixed(0) + ' KB'}</span>
        <button class="ghost" data-k="${kind}" data-del="${escapeHtml(m.name)}">Excluir</button>
      </div>
    `).join('') || `<span class="muted">${getEmptyMessage(kind)}</span>`;
    
    listEl.querySelectorAll('[data-del]').forEach(b => {
      b.onclick = async () => {
        await API.contentDelete(b.dataset.k, b.dataset.del);
        const updated = await API.contentList(b.dataset.k);
        updateInstalledList(b.dataset.k, updated);
      };
    });
  }
}

function getEmptyMessage(kind) {
  const msgs = {
    shader: 'Nenhum shader. Ex: Bliss ou Complementary.',
    resourcepack: 'Nenhum resource pack.',
    modpack: 'Nenhum modpack baixado.'
  };
  return msgs[kind] || 'Nenhum item.';
}

function updateSkinsList(data) {
  const skins = data.skins || [];
  const selected = data.selected;
  const box = document.getElementById('skins');
  if (!box) return;
  let html = '';
  for (const s of skins) {
    html += '<div class="skin-card' + (selected === s.file ? ' sel' : '') + '">';
    html += '<canvas width="64" height="128"></canvas>';
    html += '<b>' + escapeHtml(s.name) + '</b>';
    if (s.preset) html += '<span class="muted">preset</span>';
    if (selected === s.file) html += '<span class="chip">em uso</span>';
    html += '<div class="login-row">';
    html += '<button data-use="' + escapeHtml(s.file) + '" class="primary">Usar</button>';
    if (!s.preset) html += '<button data-delskin="' + escapeHtml(s.file) + '" class="ghost">Excluir</button>';
    html += '</div></div>';
  }
  box.innerHTML = html || '<span class="muted">Sem skins.</span>';
  const canvases = box.querySelectorAll('canvas');
  for (let i = 0; i < canvases.length && i < skins.length; i++) drawSkinPreview(canvases[i], skins[i].url);
  box.querySelectorAll('[data-use]').forEach(function (b) {
    b.onclick = async function () {
      b.disabled = true;
      const skinMsg = document.getElementById('skinMsg');
      if (skinMsg) skinMsg.textContent = 'Aplicando...';
      try {
        const r = await API.skinApply(b.dataset.use, document.getElementById('skinVariant').value);
        if (skinMsg) skinMsg.textContent = r.msg;
        updateSkinsList(await API.skinList());
      } catch (e) {
        if (skinMsg) skinMsg.textContent = 'Erro: ' + e.message;
      }
      b.disabled = false;
    };
  });
  box.querySelectorAll('[data-delskin]').forEach(function (b) {
    b.onclick = async function () {
      await API.skinDelete(b.dataset.delskin);
      updateSkinsList(await API.skinList());
    };
  });
}

function updateFriendsList(list) {
  const box = document.getElementById('friends');
  if (!box) return;
  
  if (!list.length) {
    box.innerHTML = '<span class="muted">Nenhum amigo. Adicione pelo nick + IP do servidor.</span>';
    return;
  }
  
  box.innerHTML = list.map(f => `
    <div class="mod">
      <b>${escapeHtml(f.nick)}</b> <span class="muted">${escapeHtml(f.address)}</span>
      <span class="chip" id="st-${escapeHtml(f.nick)}">...</span><br>
      <span class="muted" id="info-${escapeHtml(f.nick)}"></span>
      <div class="login-row">
        <button data-copy="${escapeHtml(f.address)}" class="ghost">Copiar IP</button>
        <button data-fdel="${escapeHtml(f.nick)}" class="ghost">Excluir</button>
      </div>
    </div>
  `).join('');
  
  box.querySelectorAll('[data-copy]').forEach(b => {
    b.onclick = () => navigator.clipboard.writeText(b.dataset.copy).then(() => toast.success('IP copiado'));
  });
  
  box.querySelectorAll('[data-fdel]').forEach(b => {
    b.onclick = async () => {
      await API.friendDelete(b.dataset.fdel);
      updateFriendsList(await API.friendsList());
    };
  });
  
  // Ping servers
  list.forEach(f => {
    API.friendPing(f.address).then(r => {
      const st = document.getElementById('st-' + f.nick);
      const info = document.getElementById('info-' + f.nick);
      if (!st) return;
      if (r.online) {
        st.textContent = `🟢 ${r.players} • ${r.ms}ms`;
        st.style.borderColor = '#3fa950';
        if (info) info.textContent = `${r.version} — ${r.motd}`;
      } else {
        st.textContent = '🔴 off';
        if (info) info.textContent = '';
      }
    }).catch(() => {});
  });
}

// Skin preview drawing
const _skinImgs = [];
function drawSkinPreview(canvas, url) {
  const img = new Image();
  _skinImgs.push(img);
  if (_skinImgs.length > 40) _skinImgs.splice(0, _skinImgs.length - 40);
  img.onload = () => {
    canvas.width = 64; canvas.height = 128;
    const g = canvas.getContext('2d');
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, 64, 128);
    const R = (sx, sy, sw, sh, dx, dy, dw, dh) => {
      try { g.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh); } catch {}
    };
    R(8, 8, 8, 8, 16, 0, 32, 32);    // cabeça
    R(20, 20, 8, 12, 16, 32, 32, 48); // tronco
    R(44, 20, 4, 12, 0, 32, 16, 48);  // braço dir
    R(36, 52, 4, 12, 48, 32, 16, 48); // braço esq
    R(4, 20, 4, 12, 16, 80, 16, 48);  // perna dir
    R(20, 52, 4, 12, 32, 80, 16, 48); // perna esq
  };
  img.src = url;
}

export default { init, render };