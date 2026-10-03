"use strict";
// Navegação por abas
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  document.getElementById('tab-' + b.dataset.tab).classList.add('active');
});
const $ = (id) => document.getElementById(id);
const connChip = $('conn');
function setConn(on, txt) {
  connChip.textContent = txt || (on ? 'online' : 'offline');
  connChip.className = 'chip ' + (on ? 'on' : 'off');
}

// ---------- Amigos (protocolo friend-server) ----------
let ws = null, myNick = '';
function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }
function addChat(from, text) {
  const box = $('chat'), div = document.createElement('div');
  const b = document.createElement('b'); b.textContent = from + ': ';
  div.appendChild(b); div.appendChild(document.createTextNode(text));
  box.appendChild(div); box.scrollTop = box.scrollHeight;
}
function renderMembers(list) {
  const ul = $('members'); ul.innerHTML = '';
  (list || []).forEach(m => {
    const li = document.createElement('li');
    li.textContent = (m.online === false ? '⚫ ' : '🟢 ') + m.nick;
    if (m.server) { const s = document.createElement('small'); s.textContent = `🖥 ${m.server.host}:${m.server.port}`; li.appendChild(s); }
    ul.appendChild(li);
  });
  try { localStorage.setItem('obsidian-members', JSON.stringify(list || [])); } catch {}
}
$('btnConn').onclick = () => {
  try { if (ws) ws.close(); } catch {}
  const url = $('relayUrl').value.trim() || 'ws://127.0.0.1:8091';
  myNick = ($('nick').value.trim() || 'Player').slice(0, 16);
  setConn(false, 'conectando...');
  ws = new WebSocket(url);
  ws.onopen = () => { setConn(true); send({ t: 'hello', nick: myNick }); $('roomCard').hidden = false; };
  ws.onclose = () => setConn(false);
  ws.onerror = () => setConn(false, 'erro');
  ws.onmessage = (ev) => {
    let d; try { d = JSON.parse(ev.data); } catch { return; }
    if (d.t === 'room') { $('roomCode').textContent = d.code; renderMembers([]); }
    if (d.t === 'members') renderMembers(d.list);
    if (d.t === 'member') {
      let cur = [];
      try { cur = JSON.parse(localStorage.getItem('obsidian-members') || '[]'); } catch {}
      cur = cur.filter(m => m.nick !== d.nick);
      if (d.online) cur.push({ nick: d.nick, online: true, server: d.server || null });
      renderMembers(cur);
    }
    if (d.t === 'chat') addChat(d.from, d.text);
    if (d.t === 'error') addChat('sistema', d.msg);
  };
};
$('btnCreate').onclick = () => send({ t: 'create' });
$('btnJoin').onclick = () => send({ t: 'join', code: $('joinCode').value });
$('btnSend').onclick = sendChat;
$('chatText').onkeydown = (e) => { if (e.key === 'Enter') sendChat(); };
function sendChat() { const v = $('chatText').value.trim(); if (v) { send({ t: 'chat', text: v }); $('chatText').value = ''; } }
$('btnShare').onclick = () => send({ t: 'share', host: $('srvHost').value.trim(), port: +($('srvPort').value || 25565) });

// ---------- Mods (Modrinth, só leitura) ----------
const MC = ['26.3', '1.21.1', '1.20.1'];
const mcSel = $('mcVersion');
MC.forEach(v => { const o = document.createElement('option'); o.value = o.textContent = v; mcSel.appendChild(o); });
$('btnSearch').onclick = async () => {
  const q = $('modQuery').value.trim(), box = $('mods');
  if (!q) return;
  box.innerHTML = '<p class="muted">Buscando...</p>';
  try {
    const facets = encodeURIComponent(JSON.stringify([[`categories:${$('modLoader').value}`], [`versions:${mcSel.value}`]]));
    const r = await (await fetch(`https://api.modrinth.com/v2/search?query=${encodeURIComponent(q)}&facets=${facets}&limit=15`)).json();
    box.innerHTML = '';
    (r.hits || []).forEach(m => {
      const d = document.createElement('div'); d.className = 'mod';
      const t = document.createElement('b'); t.textContent = m.title; d.appendChild(t);
      const s = document.createElement('div'); s.className = 'muted'; s.textContent = (m.description || '').slice(0, 120); d.appendChild(s);
      const a = document.createElement('a'); a.textContent = 'Abrir no Modrinth ⬈'; a.href = `https://modrinth.com/mod/${m.project_id}`; a.target = '_blank'; a.rel = 'noopener'; d.appendChild(a);
      box.appendChild(d);
    });
    if (!(r.hits || []).length) box.innerHTML = '<p class="muted">Nada encontrado.</p>';
  } catch { box.innerHTML = '<p class="muted">Falha de rede.</p>'; }
};

// ---------- Skins (Mojang + Crafatar, só prévia) ----------
$('btnSkin').onclick = async () => {
  const nick = $('skinNick').value.trim(), img = $('skinImg');
  if (!nick) return;
  img.hidden = true;
  try {
    const p = await (await fetch(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(nick)}`)).json();
    if (!p || !p.id) throw 0;
    img.src = `https://crafatar.com/renders/body/${p.id}?overlay=true&scale=6`;
    img.hidden = false;
  } catch { alert('Nick não encontrado.'); }
};

// PWA: registra service worker
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
