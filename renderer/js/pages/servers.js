/**
 * Page: Servidores (Minecraft Java, Hytale via SteamCMD, custom)
 */
import { API } from '../utils/api.js';
import { toast } from '../utils/toast.js';

let current = null;
let playitSub = false;

export async function init() {
  setupButtons();
  wireConsole();
  if (!playitSub) { playitSub = true; try { API.onPlayitState(() => { refreshPlayit(); refreshServers(); }); } catch {} }
  await refreshServers();
  await refreshPlayit();
}

export async function render() {
  await refreshServers();
  await refreshPlayit();
}

async function savePlayitSecret() {
  const v = document.getElementById('playitSecret').value.trim();
  try { await API.saveSettings({ playitSecret: v }); toast.success('Secret salvo', v ? 'Tunnel pronto p/ ativar' : '(limpo)'); }
  catch (e) { toast.error('Erro', e.message); }
}

async function togglePlayit() {
  try {
    const st = await API.playitStatus().catch(() => ({ running: false }));
    if (st.running) { await API.playitStop(); }
    else {
      const v = document.getElementById('playitSecret').value.trim();
      if (v) await API.saveSettings({ playitSecret: v });
      await API.playitStart();
      toast.success('Tunnel ativando...', 'O endereço aparece abaixo quando conectar');
    }
  } catch (e) { toast.error('Tunnel falhou', e.message); }
  refreshPlayit();
  refreshServers();
}

async function refreshPlayit() {
  const box = document.getElementById('playitStatus');
  const btn = document.getElementById('btnPlayitToggle');
  if (!box) return;
  let st;
  try { st = await API.playitStatus(); } catch (e) { box.textContent = 'Erro: ' + e.message; return; }
  if (btn) btn.textContent = st.running ? 'Parar tunnel' : 'Ativar tunnel';
  if (!st.running) { box.textContent = 'Tunnel desligado.'; return; }
  const addrs = (st.addresses || []).join(', ');
  if (st.connected && addrs) box.innerHTML = `🟢 Conectado: <b>${escapeHtml(addrs)}</b>`;
  else box.textContent = '🟡 Ligando... ' + (((st.log || []).slice(-1)[0]) || '');
}

function setupButtons() {
  const b = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  b('btnSrvAdd', addServer);
  b('btnPlayitSave', savePlayitSecret);
  b('btnPlayitToggle', togglePlayit);
  b('btnSrvCmd', sendCmd);
  const inp = document.getElementById('srvCmd');
  if (inp) inp.onkeydown = (e) => { if (e.key === 'Enter') sendCmd(); };
}

function wireConsole() {
  API.onServerLog(({ id, line }) => {
    if (id !== current) return;
    const box = document.getElementById('srvConsole');
    if (!box) return;
    box.textContent += line + '\n';
    box.scrollTop = box.scrollHeight;
  });
  API.onServerState(({ id, running }) => {
    if (id === current && !running) toast.success('Servidor parou', id);
    refreshServers();
  });
}

const typeName = { 'minecraft-java': 'MC Java', 'hytale-steamcmd': 'Hytale', 'custom': 'Custom' };

async function refreshServers() {
  const box = document.getElementById('servers');
  if (!box) return;
  let list = [];
  try { list = await API.serversList(); }
  catch (e) { box.innerHTML = '<span class="muted">Erro: ' + e.message + '</span>'; return; }
  if (!current && list.some(s => s.running)) current = list.find(s => s.running).id;
  const nameEl = document.getElementById('srvConsoleName');
  if (nameEl) { const c = list.find(s => s.id === current); nameEl.textContent = c ? c.name : ''; }
  box.innerHTML = list.map(s => {
    return `
    <div class="mod" style="padding:12px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
      <div><b>${escapeHtml(s.name)}</b>
        <span class="chip">${typeName[s.type] || s.type}</span>
        <span class="muted">${escapeHtml(s.version || '')} :${s.port || ''} ${s.running ? '🟢' : '⚫'}</span>
      </div>
      <div class="login-row" style="width:100%">
        <span class="muted">Entrar em:</span>
        <input data-addrin="${s.id}" value="${escapeHtml(s.address || '')}" placeholder="${escapeHtml(s.lan || 'localhost')}" title="Endereço que aparece p/ entrar. Vazio = usa o da sua rede. P/ jogar de fora, coloque IP público, domínio ou tunnel." style="flex:1;min-width:140px">
        <button data-saveaddr="${s.id}" class="ghost">Salvar</button>
        <button data-copyaddr="${s.id}" class="ghost">Copiar</button>
      </div>
      ${s.external ? `<div class="login-row" style="width:100%"><span class="chip">🌍 de fora: ${escapeHtml(s.external)}</span><button data-copyext="${escapeHtml(s.external)}" class="ghost">Copiar</button></div>` : ''}
      ${(s.tunnels || []).map(t => `<div class="login-row" style="width:100%"><span class="chip">🌐 tunnel: ${escapeHtml(t)}</span><button data-tunnel="${escapeHtml(t)}" data-usesrv="${s.id}" class="ghost">Usar</button></div>`).join('')}
      <div class="login-row">
        <button data-view="${s.id}" class="ghost">Console</button>
        ${s.running
          ? `<button data-stop="${s.id}" class="primary" style="background:linear-gradient(180deg,#ef4444,#b91c1c)">Parar</button>`
          : `<button data-start="${s.id}" class="primary">Iniciar</button>
             <button data-del="${s.id}" class="ghost">Excluir</button>`}
      </div>
    </div>`;}).join('') || '<span class="muted">Nenhum servidor. Crie o primeiro acima (ex: Minecraft 26.3).</span>';
  box.querySelectorAll('[data-view]').forEach(x => x.onclick = async () => {
    current = x.dataset.view;
    const el = document.getElementById('srvConsole');
    try { if (el) el.textContent = await API.serverLogGet(current); } catch (e) { if (el) el.textContent = 'Erro: ' + e.message; }
    const c = (await API.serversList()).find(v => v.id === current);
    if (nameEl) nameEl.textContent = c ? c.name : '';
  });
  box.querySelectorAll('[data-start]').forEach(x => x.onclick = async () => {
    x.disabled = true;
    try { await API.serverStart(x.dataset.start); current = x.dataset.start; toast.success('Iniciando servidor...', 'Acompanhe no console'); }
    catch (e) { toast.error('Falha ao iniciar', e.message); }
    x.disabled = false;
    refreshServers();
  });
  box.querySelectorAll('[data-stop]').forEach(x => x.onclick = async () => {
    try { await API.serverStop(x.dataset.stop); } catch (e) { toast.error('Erro', e.message); }
    refreshServers();
  });
  box.querySelectorAll('[data-del]').forEach(x => x.onclick = async () => {
    try { await API.serverDelete(x.dataset.del); refreshServers(); }
    catch (e) { toast.error('Erro', e.message); }
  });
  box.querySelectorAll('[data-saveaddr]').forEach(x => x.onclick = async () => {
    const inp = box.querySelector(`[data-addrin="${x.dataset.saveaddr}"]`);
    try { await API.serverSetAddress(x.dataset.saveaddr, inp ? inp.value.trim() : ''); toast.success('Endereço salvo', (inp && inp.value.trim()) || '(usando o da rede)'); }
    catch (e) { toast.error('Erro', e.message); }
    refreshServers();
  });
  box.querySelectorAll('[data-copyaddr]').forEach(x => x.onclick = () => {
    const inp = box.querySelector(`[data-addrin="${x.dataset.copyaddr}"]`);
    const v = (inp && inp.value.trim()) || (inp && inp.placeholder) || '';
    if (!v) return toast.warning('Sem endereço', 'Digite um endereço primeiro');
    navigator.clipboard.writeText(v).then(() => toast.success('Endereço copiado', v));
  });
  box.querySelectorAll('[data-copyext]').forEach(x => x.onclick = () => {
    navigator.clipboard.writeText(x.dataset.copyext).then(() => toast.success('Endereço externo copiado', x.dataset.copyext));
  });
  box.querySelectorAll('[data-usesrv]').forEach(x => x.onclick = async () => {
    try { await API.serverSetAddress(x.dataset.usesrv, x.dataset.tunnel); toast.success('Endereço do tunnel aplicado', x.dataset.tunnel); }
    catch (e) { toast.error('Erro', e.message); }
    refreshServers();
  });
}

async function addServer() {
  const name = document.getElementById('srvName').value.trim() || 'Servidor';
  const type = document.getElementById('srvType').value;
  const version = document.getElementById('srvVersion').value.trim() || '26.3';
  const port = document.getElementById('srvPort').value.trim() || '25565';
  const extra = document.getElementById('srvExtra').value.trim();
  const address = document.getElementById('srvAddress').value.trim();
  try {
    const s = await API.serverAdd({
      name, type, version, port, address,
      appId: type === 'hytale-steamcmd' ? extra : '',
      exe: type === 'custom' ? extra : ''
    });
    toast.success('Servidor criado', s.name);
    document.getElementById('srvName').value = '';
    document.getElementById('srvExtra').value = '';
    document.getElementById('srvAddress').value = '';
    refreshServers();
  } catch (e) { toast.error('Erro', e.message); }
}

async function sendCmd() {
  const inp = document.getElementById('srvCmd');
  if (!current) return toast.warning('Sem servidor', 'Clique em Console de um servidor rodando');
  if (!inp.value.trim()) return;
  try { await API.serverCmd(current, inp.value); inp.value = ''; }
  catch (e) { toast.error('Erro', e.message); }
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"');
}

export default { init, render };
