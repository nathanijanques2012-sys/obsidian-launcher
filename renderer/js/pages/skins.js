/**
 * Page: Skins
 * Gerenciamento de skins (Microsoft + Offline/StraySkins)
 */

import { API } from '../utils/api.js';
import { toast } from '../utils/toast.js';
import { createSkinSkeleton, createGridSkeleton, showSkeleton, hideSkeleton } from '../components/Skeleton.js';

const _skinImgs = [];

export async function init({ state, API, toast, Skeleton }) {
  setupButtons();
  await refreshSkins();
}

export async function render() {
  await refreshSkins();
}

function setupButtons() {
  const btnImport = document.getElementById('btnSkinImport');
  if (btnImport) btnImport.onclick = importSkin;
  
  const btnRefresh = document.getElementById('btnSkinsRefresh');
  if (btnRefresh) btnRefresh.onclick = refreshSkins;
}

async function refreshSkins() {
  const box = document.getElementById('skins');
  const skinMsg = document.getElementById('skinMsg');
  if (!box) return;
  
  showSkeleton(box, createGridSkeleton(8, 4));
  if (skinMsg) skinMsg.textContent = '';
  
  try {
    const { skins, selected } = await API.skinList();
    
    if (!skins.length) {
      hideSkeleton(box, '<span class="muted">Sem skins. Importe um PNG 64x64.</span>');
      return;
    }
    
    box.innerHTML = skins.map(s => `
      <div class="skin-card${selected === s.file ? ' sel' : ''}" data-file="${escapeHtml(s.file)}">
        <canvas width="64" height="128"></canvas>
        <b>${escapeHtml(s.name)}</b>${s.preset ? '<span class="muted">preset</span>' : ''}
        ${selected === s.file ? '<span class="chip">em uso</span>' : ''}
        <div class="login-row">
          <button data-use="${escapeHtml(s.file)}" class="primary">Usar</button>
          ${s.preset ? '' : `<button data-delskin="${escapeHtml(s.file)}" class="ghost">Excluir</button>`}
        </div>
      </div>
    `).join('');
    
    // Draw previews lazily
    const canvases = box.querySelectorAll('canvas');
    skins.forEach((s, i) => {
      if (canvases[i]) drawSkinPreview(canvases[i], s.url);
    });
    
    // Bind actions
    box.querySelectorAll('[data-use]').forEach(b => {
      b.onclick = async () => {
        b.disabled = true;
        if (skinMsg) skinMsg.textContent = 'Aplicando...';
        try {
          const variant = document.getElementById('skinVariant').value;
          const r = await API.skinApply(b.dataset.use, variant);
          if (skinMsg) skinMsg.textContent = r.msg;
          toast.success('Skin aplicada', r.msg);
          refreshSkins();
        } catch (e) {
          if (skinMsg) skinMsg.textContent = 'Erro: ' + e.message;
          toast.error('Erro ao aplicar skin', e.message);
        }
        b.disabled = false;
      };
    });
    
    box.querySelectorAll('[data-delskin]').forEach(b => {
      b.onclick = async () => {
        try {
          await API.skinDelete(b.dataset.delskin);
          toast.success('Skin excluída');
          refreshSkins();
        } catch (e) {
          toast.error('Erro ao excluir', e.message);
        }
      };
    });
    
  } catch (err) {
    hideSkeleton(box, `<span class="muted">Erro: ${err.message}</span>`);
    toast.error('Erro ao carregar skins', err.message);
  }
}

async function importSkin() {
  try {
    const r = await API.skinImport();
    if (r) {
      toast.success('Skin importada', r.file);
      refreshSkins();
    }
  } catch (err) {
    const skinMsg = document.getElementById('skinMsg');
    if (skinMsg) skinMsg.textContent = 'Erro: ' + err.message;
    toast.error('Erro ao importar', err.message);
  }
}

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

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

export default { init, render };