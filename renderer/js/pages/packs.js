/**
 * Page: Resource Packs (Texturas)
 */

import { API } from '../utils/api.js';
import { toast } from '../utils/toast.js';
import { VirtualList } from '../components/VirtualList.js';
import { createModSkeleton, createListSkeletonLines, showSkeleton, hideSkeleton } from '../components/Skeleton.js';
import { createSearchInput } from '../hooks/useDebounce.js';

let virtualList = null;
let searchCleanup = null;

export async function init({ state, API, toast, VirtualList, Skeleton, createSearchInput }) {
  const packQuery = document.getElementById('packQuery');
  const packsContainer = document.getElementById('packs');
  
  if (packQuery && packsContainer) {
    searchCleanup = createSearchInput({
      input: packQuery,
      searchFn: async (query) => {
        const loader = document.getElementById('loader').value;
        const version = document.getElementById('version').value;
        const result = await API.searchModrinth(query, loader, version, 'resourcepack');
        return result.hits || [];
      },
      onResults: (results) => renderResults(results, packsContainer),
      delay: 300,
      minLength: 2
    });
  }
  
  setupButtons();
  initInstalledVirtualList();
  bindDelete();
}

function bindDelete() {
  // Delegação no container: sobrevive aos re-renders do VirtualList.
  const container = document.getElementById('packsInstalled');
  if (!container || container.dataset.delBound) return;
  container.dataset.delBound = '1';
  container.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    try {
      await API.contentDelete('resourcepack', b.dataset.del);
      toast.success('Excluído', b.dataset.del);
      await refreshInstalled();
    } catch (err) { toast.error('Erro ao excluir', err.message); }
  });
}

export async function render() {
  await refreshInstalled();
}

function setupButtons() {
  const btnSearch = document.getElementById('btnPackSearch');
  if (btnSearch) {
    btnSearch.onclick = () => {
      const input = document.getElementById('packQuery');
      if (input) input.dispatchEvent(new Event('input'));
    };
  }
  
  const btnFolder = document.getElementById('btnPacksFolder');
  if (btnFolder) btnFolder.onclick = () => API.openContentFolder('resourcepack');
  
  const btnRefresh = document.getElementById('btnPacksRefresh');
  if (btnRefresh) btnRefresh.onclick = refreshInstalled;
}

async function refreshInstalled() {
  const container = document.getElementById('packsInstalled');
  const countEl = document.getElementById('packsCount');
  if (!container) return;
  
  showSkeleton(container, createListSkeletonLines(3));
  
  try {
    const list = await API.contentList('resourcepack');
    if (countEl) countEl.textContent = list.length;
    
    // Recria sempre: o skeleton acima destrói o DOM interno do VirtualList
    // anterior — setItems escrevia num DOM removido e a tela ficava presa no esqueleto.
    if (virtualList) { try { virtualList.destroy(); } catch {} virtualList = null; }
    virtualList = new VirtualList({
      container,
      items: list,
      itemHeight: 64,
      buffer: 3,
      renderItem: renderInstalledItem,
      emptyMessage: 'Nenhum resource pack.'
    });
  } catch (err) {
    hideSkeleton(container, `<span class="muted">Erro: ${err.message}</span>`);
    toast.error('Erro ao listar packs', err.message);
  }
}

function initInstalledVirtualList() {
  const container = document.getElementById('packsInstalled');
  if (!container) return;
  
  virtualList = new VirtualList({
    container,
    items: [],
    itemHeight: 64,
    buffer: 3,
    renderItem: renderInstalledItem,
    emptyMessage: 'Nenhum resource pack.'
  });
}

function renderInstalledItem(item) {
  return `
    <div class="mod" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px;">
      <div>
        <b style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;max-width:300px;">${escapeHtml(item.name)}</b>
        <span class="muted" style="font-size:12px;">${(item.size / 1024 / 1024).toFixed(1)} MB</span>
      </div>
      <button class="ghost" data-k="resourcepack" data-del="${escapeHtml(item.name)}" style="font-size:12px;padding:6px 10px;">Excluir</button>
    </div>
  `;
}

function renderResults(results, container) {
  if (!results || !results.length || results.error) {
    hideSkeleton(container, results.error ? `<span class="muted">Erro: ${escapeHtml(results.error)}</span>` : '<span class="muted">Nada encontrado</span>');
    return;
  }
  
  const version = document.getElementById('version').value;
  
  const html = results.map(mod => `
    <div class="mod" style="padding:12px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
        <div style="flex:1;min-width:0;">
          <b style="font-size:15px;">${escapeHtml(mod.title)}</b>
          <span class="chip">Resource Pack • MC ${escapeHtml(version)}</span>
          <span class="muted" style="margin-left:8px;">⬇ ${mod.downloads || 0}</span>
          <div class="muted" style="margin-top:6px;max-height:40px;overflow:hidden;">${escapeHtml((mod.description || '').slice(0, 140))}</div>
        </div>
        <button class="dlx primary" data-pid="${escapeHtml(mod.project_id)}" data-kind="resourcepack" style="flex-shrink:0;white-space:nowrap;">Baixar p/ ${escapeHtml(version)}</button>
      </div>
    </div>
  `).join('');
  
  hideSkeleton(container, html);
  
  container.querySelectorAll('.dlx').forEach(btn => {
    btn.onclick = async () => handleDownload(btn);
  });
}

async function handleDownload(btn) {
  const projectId = btn.dataset.pid;
  const loader = document.getElementById('loader').value;
  const version = document.getElementById('version').value;
  
  btn.disabled = true;
  btn.textContent = 'Baixando...';
  
  try {
    const res = await API.contentDownload('resourcepack', projectId, loader, version);
    btn.textContent = (res.skipped ? 'Já instalado ✓ ' : 'Instalado ✓ ') + (res.file || '');
    if (res.version) btn.textContent += ` (v${res.version})`;
    
    toast.success(res.skipped ? 'Já instalado' : 'Resource pack instalado', res.file || '');
    await refreshInstalled();
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Erro';
    toast.error('Download falhou', err.message);
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

export default { init, render };