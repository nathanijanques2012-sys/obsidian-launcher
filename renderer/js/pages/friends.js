/**
 * Page: Friends
 * Sistema de amigos com ping real de servidores
 */

import { API } from '../utils/api.js';
import { toast } from '../utils/toast.js';
import { createFriendSkeleton, createListSkeletonLines, showSkeleton, hideSkeleton } from '../components/Skeleton.js';

export async function init({ state, API, toast, Skeleton }) {
  setupButtons();
  try {
    const acc = await API.getAccount().catch(() => null);
    const nickEl = document.getElementById('relayNick');
    if (nickEl && !nickEl.value && acc && acc.name) nickEl.value = acc.name;
    const urlEl = document.getElementById('relayUrl');
    if (urlEl && !urlEl.value) urlEl.value = 'ws://127.0.0.1:8091';
  } catch {}
  await refreshFriends();
}

export async function render() {
  await refreshFriends();
}

function setupButtons() {
  const btnAdd = document.getElementById('btnFriendAdd');
  if (btnAdd) btnAdd.onclick = addFriend;
  
  const btnRefresh = document.getElementById('btnFriendsRefresh');
  if (btnRefresh) btnRefresh.onclick = refreshFriends;
  
  const btnInviteCreate = document.getElementById('btnInviteCreate');
  if (btnInviteCreate) btnInviteCreate.onclick = createInvite;
  
  const btnInviteAccept = document.getElementById('btnInviteAccept');
  if (btnInviteAccept) btnInviteAccept.onclick = acceptInvite;
}

async function refreshFriends() {
  const box = document.getElementById('friends');
  if (!box) return;
  
  showSkeleton(box, createListSkeletonLines(5));
  
  try {
    const list = await API.friendsList();
    
    if (!list.length) {
      hideSkeleton(box, '<span class="muted">Nenhum amigo. Adicione pelo nick + IP do servidor.</span>');
      return;
    }
    
    box.innerHTML = list.map(f => `
      <div class="mod" style="padding:12px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;">
          <div style="flex:1;min-width:200px;">
            <b>${escapeHtml(f.nick)}</b>
            <span class="muted" style="margin-left:8px;">${escapeHtml(f.address)}</span>
          </div>
          <span class="chip" id="st-${escapeHtml(f.nick)}">🔄 Verificando...</span>
        </div>
        <div class="muted" id="info-${escapeHtml(f.nick)}" style="margin-top:6px;"></div>
        <div class="login-row" style="margin-top:10px;">
          <button data-copy="${escapeHtml(f.address)}" class="ghost">Copiar IP</button>
          <button data-fdel="${escapeHtml(f.nick)}" class="ghost">Excluir</button>
        </div>
      </div>
    `).join('');
    
    // Bind actions
    box.querySelectorAll('[data-copy]').forEach(b => {
      b.onclick = () => {
        navigator.clipboard.writeText(b.dataset.copy);
        toast.success('IP copiado', b.dataset.copy);
      };
    });
    
    box.querySelectorAll('[data-fdel]').forEach(b => {
      b.onclick = async () => {
        await API.friendDelete(b.dataset.fdel);
        toast.success('Amigo removido');
        refreshFriends();
      };
    });
    
    // Ping all servers
    list.forEach(f => {
      API.friendPing(f.address).then(r => {
        const st = document.getElementById('st-' + f.nick);
        const info = document.getElementById('info-' + f.nick);
        if (!st) return;
        if (r.online) {
          st.textContent = `🟢 ${r.players} • ${r.ms}ms`;
          st.style.borderColor = '#3fa950';
          st.style.background = 'linear-gradient(135deg, #1a5c2e, #166534)';
          if (info) info.textContent = `${r.version} — ${r.motd}`;
        } else {
          st.textContent = '🔴 Offline';
          st.style.borderColor = '#991b1b';
          st.style.background = 'linear-gradient(135deg, #7f1d1d, #991b1b)';
          if (info) info.textContent = r.error ? `Erro: ${r.error}` : '';
        }
      }).catch(() => {
        const st = document.getElementById('st-' + f.nick);
        if (st) {
          st.textContent = '🔴 Erro';
          st.style.borderColor = '#991b1b';
        }
      });
    });
    
  } catch (err) {
    hideSkeleton(box, `<span class="muted">Erro: ${err.message}</span>`);
    toast.error('Erro ao carregar amigos', err.message);
  }
}

async function addFriend() {
  const nick = document.getElementById('friendNick').value.trim();
  const addr = document.getElementById('friendAddr').value.trim().replace(/\s/g, '');
  
  if (!nick) return toast.warning('Nick vazio', 'Digite o nick do amigo');
  if (!/^[\w.\-:]+$/.test(addr)) return toast.warning('Endereço inválido', 'Use formato IP:porta (ex: jogar.meuservidor.com:25565)');
  
  try {
    await API.friendAdd(nick, addr);
    document.getElementById('friendNick').value = '';
    document.getElementById('friendAddr').value = '';
    toast.success('Amigo adicionado', nick);
    refreshFriends();
  } catch (err) {
    toast.error('Erro ao adicionar', err.message);
  }
}

async function createInvite() {
  const inviteAddr = document.getElementById('inviteAddr').value.trim() || document.getElementById('friendAddr').value.trim();
  const inviteOut = document.getElementById('inviteOut');
  
  if (!inviteAddr) return toast.warning('Endereço vazio', 'Digite o IP do seu servidor');
  
  try {
    const r = await API.inviteCreate(inviteAddr);
    if (inviteOut) inviteOut.textContent = `Código (${r.mc || 'versão atual'}): ${r.code} — manda p/ seu amigo colar no Obsidian dele.`;
    toast.success('Convite criado', `Código: ${r.code}`);
  } catch (err) {
    if (inviteOut) inviteOut.textContent = 'Erro: ' + err.message;
    toast.error('Erro ao criar convite', err.message);
  }
}

async function acceptInvite() {
  const code = document.getElementById('inviteCode').value.trim();
  const inviteOut = document.getElementById('inviteOut');
  
  if (!code) return toast.warning('Código vazio', 'Cole o código OBS1-...');
  
  try {
    const r = await API.inviteAccept(code, '');
    if (inviteOut) inviteOut.textContent = `${r.nick} (${r.address}) adicionado ✓`;
    document.getElementById('inviteCode').value = '';
    toast.success('Convite aceito', `${r.nick} adicionado aos amigos`);
    refreshFriends();
  } catch (err) {
    if (inviteOut) inviteOut.textContent = 'Erro: ' + err.message;
    toast.error('Convite inválido', err.message);
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

// ---------- Sala online (relay) ----------
const relay = { ws: null, room: null, members: new Map() };
function relayStatus(t) { const el = document.getElementById('relayStatus'); if (el) el.textContent = t; }
function relaySend(o) { if (relay.ws && relay.ws.readyState === 1) relay.ws.send(JSON.stringify(o)); }

function renderMembers() {
  const box = document.getElementById('roomMembers');
  if (!box) return;
  const list = [...relay.members.entries()];
  document.getElementById('roomInfo').textContent = relay.room ? `Sala ${relay.room} (${list.length})` : '';
  try { API.friendSync({ room: relay.room || '', members: list.map(([n]) => n) }); } catch {}
  box.innerHTML = list.map(([nick, m]) => `
    <div class="mod" style="padding:10px;display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
      <div><b>${escapeHtml(nick)}</b> <span class="muted">🟢</span>
      ${m.server ? `<br><span class="muted">🖥 ${escapeHtml(m.server.host)}:${m.server.port} ${m.server.mc ? `(MC ${escapeHtml(m.server.mc)})` : ''}</span>` : '<br><span class="muted">sem servidor</span>'}
      </div>
      ${m.server ? `<button data-join="${escapeHtml(nick)}" class="primary">Entrar</button>` : ''}
    </div>`).join('') || '<span class="muted">Só você aqui. Passe o código!</span>';
  box.querySelectorAll('[data-join]').forEach(b => b.onclick = () => joinFriendServer(b.dataset.join));
}

function chatAdd(from, text) {
  const box = document.getElementById('roomChat');
  if (!box) return;
  const div = document.createElement('div');
  div.innerHTML = `<b>${escapeHtml(from)}</b>: ${escapeHtml(text)}`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

async function joinFriendServer(nick) {
  const m = relay.members.get(nick);
  if (!m || !m.server) return toast.warning('Sem servidor', nick + ' não divulgou servidor');
  try {
    const s = await API.getSettings();
    toast.success('Entrando...', `${m.server.host}:${m.server.port}`);
    await API.launch({ version: s.version, loader: s.loader, server: { host: m.server.host, port: m.server.port } });
  } catch (err) { toast.error('Falha ao entrar', err.message); }
}

function setupRelay() {
  const btnC = document.getElementById('btnRelayConnect');
  if (btnC) btnC.onclick = () => {
    if (relay.ws && relay.ws.readyState <= 1) { try { relay.ws.close(); } catch {} return; }
    const url = (document.getElementById('relayUrl').value || 'ws://127.0.0.1:8091').trim();
    const nick = (document.getElementById('relayNick').value || 'Player').trim().slice(0, 16);
    relayStatus('Conectando...');
    const ws = new WebSocket(url);
    relay.ws = ws; relay.members.clear(); relay.room = null;
    ws.onopen = () => { relayStatus('Online ✓'); ws.send(JSON.stringify({ t: 'hello', nick })); document.getElementById('roomBox').style.display = 'block'; };
    ws.onclose = () => { relayStatus('Desconectado'); document.getElementById('roomBox').style.display = 'none'; btnC.textContent = 'Conectar'; };
    ws.onerror = () => { relayStatus('Erro de conexão'); toast.error('Relay inacessível', 'Ligou o friend-server?'); };
    ws.onmessage = (ev) => {
      let d; try { d = JSON.parse(ev.data); } catch { return; }
      if (d.t === 'room') { relay.room = d.code; relay.members.clear(); renderMembers(); }
      if (d.t === 'members') { relay.members.clear(); for (const m of d.list) relay.members.set(m.nick, { server: m.server }); renderMembers(); }
      if (d.t === 'member') {
        if (d.online) relay.members.set(d.nick, { server: d.server });
        else relay.members.delete(d.nick);
        renderMembers();
      }
      if (d.t === 'chat') chatAdd(d.from, d.text);
      if (d.t === 'left') { relay.room = null; relay.members.clear(); renderMembers(); }
      if (d.t === 'error') toast.error('Sala', d.msg);
    };
    btnC.textContent = 'Desconectar';
  };
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  on('btnRoomCreate', () => relaySend({ t: 'create' }));
  on('btnRoomJoin', () => relaySend({ t: 'join', code: document.getElementById('roomCode').value }));
  on('btnRoomLeave', () => relaySend({ t: 'leave' }));
  on('btnChatSend', () => {
    const inp = document.getElementById('chatText');
    if (inp.value.trim()) { relaySend({ t: 'chat', text: inp.value }); inp.value = ''; }
  });
  const chatInp = document.getElementById('chatText');
  if (chatInp) chatInp.onkeydown = (e) => { if (e.key === 'Enter') document.getElementById('btnChatSend').click(); };
  on('btnShare', async () => {
    const s = await API.getSettings().catch(() => ({}));
    relaySend({ t: 'share', host: document.getElementById('shareHost').value.trim(), port: +(document.getElementById('sharePort').value || 25565), mc: s.version || '' });
    toast.success('Servidor divulgado', 'Amigos da sala podem entrar com 1 clique');
  });
  on('btnUnshare', () => relaySend({ t: 'share', host: '', port: 0 }));
}

setupRelay();

export default { init, render };