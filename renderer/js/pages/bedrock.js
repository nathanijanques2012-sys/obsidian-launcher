/**
 * Page: Bedrock (Microsoft Store)
 */
import { API } from '../utils/api.js';
import { toast } from '../utils/toast.js';

export async function init() {
  const btn = document.getElementById('btnBedrockPlay');
  if (btn) btn.onclick = async () => {
    try { await API.bedrockLaunch(); }
    catch (e) { toast.error('Falha ao abrir', e.message); }
  };
  const rf = document.getElementById('btnBedrockRefresh');
  if (rf) rf.onclick = refresh;
  await refresh();
}

export async function render() {
  await refresh();
}

async function refresh() {
  const box = document.getElementById('bedrockInfo');
  if (!box) return;
  box.textContent = 'Verificando...';
  try {
    const s = await API.bedrockStatus();
    box.innerHTML = s.installed
      ? `Instalado ✓ <span class="chip">v${escapeHtml(s.version)}</span> — abre com sua conta Xbox.`
      : 'Não encontrado. Instale pela Microsoft Store (é pago, sem modo offline).';
  } catch (e) { box.textContent = 'Erro: ' + e.message; }
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
}

export default { init, render };
