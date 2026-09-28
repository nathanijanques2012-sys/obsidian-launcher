// Obsidian Friend Relay — salas por código, presença, chat e convite p/ servidor.
// Uso: node server.js [porta]   (padrão 8091)
// Protocolo JSON por mensagem {t, ...}:
//  -> {t:'hello', nick}                       <- {t:'ok', you}
//  -> {t:'create'}                            <- {t:'room', code}
//  -> {t:'join', code}                        <- {t:'room', code} + membros
//  -> {t:'chat', text}                        -> {t:'chat', from, text, at}
//  -> {t:'share', host, port, mc}             -> {t:'member', ...} p/ sala
//  -> {t:'leave'}                             -> {t:'left'}
//  <- {t:'member', nick, online, server}      (qualquer mudança)
//  <- {t:'members', list:[...]}               (ao entrar)
//  <- {t:'error', msg}
const WebSocket = require('ws');
const PORT = +(process.argv[2] || process.env.PORT || 8091);
const wss = new WebSocket.Server({ port: PORT });
const rooms = new Map(); // code -> Map(nick -> {ws, server})

const code = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const cleanNick = (n) => String(n || '').trim().slice(0, 16) || 'Player';
const send = (ws, o) => { try { if (ws.readyState === 1) ws.send(JSON.stringify(o)); } catch {} };
const members = (room) => [...room.entries()].map(([nick, m]) => ({ nick, online: m.ws.readyState === 1, server: m.server || null }));
const broadcast = (room, o, except) => { for (const [, m] of room) if (m.ws !== except) send(m.ws, o); };

wss.on('connection', (ws) => {
  let nick = null, roomCode = null;
  const room = () => (roomCode && rooms.get(roomCode)) || null;
  const leave = () => {
    const r = room();
    if (r && nick) { r.delete(nick); if (!r.size) rooms.delete(roomCode); else broadcast(r, { t: 'member', nick, online: false, server: null }); }
    roomCode = null;
  };
  ws.on('message', (raw) => {
    let m;
    try { m = JSON.parse(raw); } catch { return send(ws, { t: 'error', msg: 'JSON inválido' }); }
    if (m.t === 'hello') { nick = cleanNick(m.nick); return send(ws, { t: 'ok', you: nick }); }
    if (!nick) return send(ws, { t: 'error', msg: 'Envie hello primeiro' });
    if (m.t === 'create') {
      leave();
      let c; do { c = code(); } while (rooms.has(c));
      rooms.set(c, new Map());
      roomCode = c; rooms.get(c).set(nick, { ws, server: null });
      return send(ws, { t: 'room', code: c });
    }
    if (m.t === 'join') {
      const c = String(m.code || '').toUpperCase().trim();
      const r = rooms.get(c);
      if (!r) return send(ws, { t: 'error', msg: 'Sala não encontrada' });
      leave();
      roomCode = c;
      if ([...r.keys()].some(k => k.toLowerCase() === nick.toLowerCase())) nick = nick + Math.floor(Math.random() * 99);
      r.set(nick, { ws, server: null });
      send(ws, { t: 'room', code: c });
      send(ws, { t: 'members', list: members(r) });
      broadcast(r, { t: 'member', nick, online: true, server: null }, ws);
      return;
    }
    if (m.t === 'leave') { leave(); return send(ws, { t: 'left' }); }
    const r = room();
    if (!r) return send(ws, { t: 'error', msg: 'Fora de sala' });
    if (m.t === 'chat') {
      const text = String(m.text || '').slice(0, 300);
      if (!text.trim()) return;
      return broadcast(r, { t: 'chat', from: nick, text, at: Date.now() });
    }
    if (m.t === 'share') {
      const me = r.get(nick);
      me.server = m.host ? { host: String(m.host).slice(0, 100), port: +(m.port || 25565), mc: String(m.mc || '').slice(0, 16) } : null;
      return broadcast(r, { t: 'member', nick, online: true, server: me.server });
    }
  });
  ws.on('close', leave);
  ws.on('error', () => {});
  setTimeout(() => { try { if (!nick) ws.close(); } catch {} }, 15000);
});
console.log(`Obsidian Friend Relay na porta ${PORT}`);
