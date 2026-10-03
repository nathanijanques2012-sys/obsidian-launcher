// playit.gg: expõe servidor na internet sem port forward (tunnel).
// O launcher baixa o agente, roda com o secret da conta e detecta o
// endereço público p/ preencher o "Entrar em" sozinho.
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const AGENT_VER = 'v1.0.10';
const AGENT_URL = `https://github.com/playit-cloud/playit-agent/releases/download/${AGENT_VER}/playit-windows-x86_64.exe`;

let proc = null;
let secretFile = '';
let state = { running: false, connected: false, addresses: [], log: [] };
let onEvent = null;

function agentExe(userData) {
  return path.join(userData, 'tools', 'playit', 'playit.exe');
}

async function ensureAgent(userData, downloadFile) {
  const dest = agentExe(userData);
  try {
    if (fs.existsSync(dest) && fs.statSync(dest).size > 1024 * 1024) return dest;
  } catch {}
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  await downloadFile(AGENT_URL, dest, 'playit.gg');
  return dest;
}

function emit(type, data) {
  try { onEvent && onEvent(type, data); } catch {}
}

function pushLog(line) {
  state.log.push(line);
  if (state.log.length > 60) state.log.splice(0, state.log.length - 60);
  emit('log', line);
}

function parseLine(line) {
  // Endereço público do tunnel: xxx.playit.gg:12345 (ou .ply.gg)
  const m = line.match(/([a-z0-9][a-z0-9.-]*\.(playit\.gg|ply\.gg)(:\d+)?)/i);
  if (m && !state.addresses.includes(m[1])) {
    state.addresses.push(m[1]);
    emit('state', publicStatus());
  }
  if (/established|connected|authenticated|session/i.test(line) && !state.connected) {
    state.connected = true;
    emit('state', publicStatus());
  }
}

function publicStatus() {
  return { running: state.running, connected: state.connected, addresses: [...state.addresses] };
}

async function start(userData, secret, downloadFile) {
  if (proc) return { already: true };
  if (!secret) throw new Error('Falta o secret do playit.gg (aba Servidores > Tunnel).');
  const exe = await ensureAgent(userData, downloadFile);
  // Secret em arquivo (não vaza na linha de comando)
  secretFile = path.join(path.dirname(exe), 'secret.txt');
  fs.writeFileSync(secretFile, String(secret).trim());
  state = { running: true, connected: false, addresses: [], log: [] };
  proc = spawn(exe, ['--secret-path', secretFile], { windowsHide: true });
  pushLog('playit: agente iniciado');
  proc.stdout.on('data', (d) => String(d).split('\n').forEach(l => { l = l.trim(); if (l) { pushLog(l); parseLine(l); } }));
  proc.stderr.on('data', (d) => String(d).split('\n').forEach(l => { l = l.trim(); if (l) pushLog(l); }));
  proc.on('exit', (code) => { proc = null; state.running = false; state.connected = false; pushLog(`playit: saiu (código ${code})`); emit('state', publicStatus()); });
  proc.on('error', (e) => { proc = null; state.running = false; state.connected = false; pushLog('playit ERRO: ' + e.message); emit('state', publicStatus()); });
  emit('state', publicStatus());
  return { started: true };
}

function stop() {
  if (!proc) return { stopped: false };
  try { proc.kill(); } catch {}
  proc = null;
  state.running = false;
  state.connected = false;
  emit('state', publicStatus());
  return { stopping: true };
}

function status() {
  return { ...publicStatus(), log: state.log.slice(-20) };
}

module.exports = { start, stop, status, setEventHandler: (fn) => { onEvent = fn; }, agentExe };
