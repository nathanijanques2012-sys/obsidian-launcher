// Obsidian Launcher - processo principal
// Requer: conta Microsoft dona do Minecraft Java + Java 17/21 instalado
const { app, BrowserWindow, ipcMain, shell, screen, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { Client, Authenticator } = require('minecraft-launcher-core');
const { autoUpdater } = require('electron-updater');
const { execSync, execFileSync } = require('child_process');
const upnp = require('./upnp'); // UPnP IGD p/ expor servidor sem mexer no roteador
const playit = require('./playit'); // tunnel playit.gg (sem port forward)

app.setAppUserModelId('com.obsidian.launcher');
app.setName('Obsidian Launcher');

let win;
const userData = () => app.getPath('userData');
const settingsPath = () => path.join(userData(), 'settings.json');
const accountsPath = () => path.join(userData(), 'accounts.json');

function loadJson(p, fallback) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}
function saveJson(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

async function fetchT(url, opts = {}, ms = 45000) {
  // fetch com timeout p/ o JOGAR nunca travar mudo numa API lenta
  const r = await fetch(url, { ...opts, signal: AbortSignal.timeout(ms) });
  return r;
}

async function downloadFile(url, dest, label = 'arquivo') {
  // curl.exe é mais robusto que fetch p/ arquivos grandes em PC fraco; fetch de fallback
  const log = (m) => win?.webContents.send('launch-log', m);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  log(`Baixando ${label}...`);
  let lastErr = '';
  try {
    execFileSync('curl.exe', ['-L', '--fail', '--connect-timeout', '30', '--max-time', '1800', '--retry', '2', '-o', dest, url], { stdio: 'ignore', timeout: 1820000 });
  } catch (e) { lastErr = 'curl falhou (rede bloqueada ou lenta)'; }
  if (!fs.existsSync(dest) || fs.statSync(dest).size < 1024) {
    try {
      log('Tentando download alternativo...');
      const r = await fetch(url, { signal: AbortSignal.timeout(1800000) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
    } catch (e2) {
      try { fs.unlinkSync(dest); } catch {}
      throw new Error(`Download ${label} falhou (${lastErr}). Cheque internet/espaço em disco.`);
    }
  }
  const sz = fs.statSync(dest).size;
  log(`${label} baixado (${(sz / 1048576).toFixed(1)} MB) ✓`);
}

const MESA_VER = '26.2.3';
const MESA_URL = `https://github.com/pal1000/mesa-dist-win/releases/download/${MESA_VER}/mesa3d-${MESA_VER}-release-msvc.7z`;
const MESA_RAW = 'https://raw.githubusercontent.com/nathanijanques2012-sys/obsidian-launcher/main/redist/mesa';
const MESA_DLLS = ['opengl32.dll', 'libgallium_wgl.dll'];
const MESA_PARTS = 3;

async function fetchMesaPredbuilt(mesaDir) {
  // DLLs prontas, sem extração (p/ Windows sem tar.exe)
  const log = (m) => win?.webContents.send('launch-log', m);
  const x64 = path.join(mesaDir, 'x64');
  fs.mkdirSync(x64, { recursive: true });
  log('Baixando Mesa3D (~60MB, só na 1ª vez)...');
  await downloadFile(`${MESA_RAW}/opengl32.dll`, path.join(x64, 'opengl32.dll'), 'Mesa3D (1/4)');
  for (let i = 0; i < MESA_PARTS; i++) {
    await downloadFile(`${MESA_RAW}/libgallium_wgl.dll.part${i}`, path.join(x64, `libgallium_wgl.dll.part${i}`), `Mesa3D (${i + 2}/4)`);
  }
  const out = fs.openSync(path.join(x64, 'libgallium_wgl.dll'), 'w');
  try {
    for (let i = 0; i < MESA_PARTS; i++) {
      const p = path.join(x64, `libgallium_wgl.dll.part${i}`);
      const b = fs.readFileSync(p);
      fs.writeSync(out, b, 0, b.length);
      fs.unlinkSync(p);
    }
  } finally { fs.closeSync(out); }
  const got = fs.statSync(path.join(x64, 'libgallium_wgl.dll')).size;
  if (got !== 61868544) { fs.rmSync(path.join(x64, 'libgallium_wgl.dll'), { force: true }); throw new Error(`Mesa corrompido (${got} bytes). Tentando de novo...`); }
  if (!MESA_DLLS.every(f => fs.existsSync(path.join(x64, f)))) throw new Error('Mesa incompleto');
}

async function applySoftwareGL(javaExe, on) {
  // Mesa llvmpipe ao lado do javaw.exe = OpenGL por software (emergência sem driver).
  // JDK original NÃO tem esses arquivos, então é seguro colocar/remover.
  const log = (m) => win?.webContents.send('launch-log', m);
  const binDir = path.dirname(javaExe);
  const flag = path.join(userData(), '.mesa', 'active');
  const wasOn = (() => { try { return fs.readFileSync(flag, 'utf8') === binDir; } catch { return false; } })();
  if (!on) {
    // Sempre garante a saída: a flag pode ter sumido e as DLLs ficado
    let gone = 0;
    for (const f of MESA_DLLS) { try { fs.unlinkSync(path.join(binDir, f)); gone++; } catch {} }
    try { fs.unlinkSync(flag); } catch {}
    if (gone) log('Renderização por hardware restaurada ✓');
    return;
  }
  const mesaDir = path.join(userData(), '.mesa', MESA_VER);
  if (wasOn && MESA_DLLS.every(f => fs.existsSync(path.join(binDir, f)))) return; // já ativo
  const have = MESA_DLLS.every(f => fs.existsSync(path.join(mesaDir, 'x64', f)));
  if (!have) {
    try {
      await fetchMesaPredbuilt(mesaDir);
    } catch (e) {
      // Fallback: pacote .7z oficial + tar
      log('Método direto falhou, tentando pacote oficial...');
      const zip = path.join(userData(), '.cache', 'mesa.7z');
      await downloadFile(MESA_URL, zip, 'Mesa3D');
      log('Extraindo Mesa3D...');
      fs.rmSync(mesaDir, { recursive: true, force: true });
      fs.mkdirSync(mesaDir, { recursive: true });
      try {
        execFileSync('tar.exe', ['-xf', zip, '-C', mesaDir], { stdio: 'ignore', timeout: 300000 });
      } catch {
        throw new Error('Falha ao extrair Mesa (tar.exe ausente? Windows 10+ necessário).');
      }
      fs.rmSync(zip, { force: true });
      if (!MESA_DLLS.every(f => fs.existsSync(path.join(mesaDir, 'x64', f)))) throw new Error('Mesa extraído incompleto');
    }
  }
  for (const f of MESA_DLLS) fs.copyFileSync(path.join(mesaDir, 'x64', f), path.join(binDir, f));
  fs.mkdirSync(path.dirname(flag), { recursive: true });
  fs.writeFileSync(flag, binDir);
  log('Modo compatibilidade ATIVO (software, FPS menor) ✓');
}

function getBundledJava(major = 21) {
  // Java 25: prefere o JRE (o JDK completo derruba a SDL3 do MC 26.x)
  const candidates = major === 25 ? [
    path.join(__dirname, '.jre25', 'bin', 'javaw.exe'), // dev
    path.join(userData(), '.jre25', 'bin', 'javaw.exe') // provisionado
  ] : [];
  candidates.push(
    path.join(__dirname, `.jdk${major}`, 'bin', 'javaw.exe'), // dev
    path.join(userData(), `.jdk${major}`, 'bin', 'javaw.exe') // provisionado
  );
  // Instalação padrão (Microsoft / Temurin / Oracle)
  const pf = process.env['ProgramFiles'] || 'C:\\Program Files';
  const javaHome = process.env['JAVA_HOME'];
  if (javaHome) candidates.push(path.join(javaHome, 'bin', 'javaw.exe'));
  try {
    for (const base of [path.join(pf, 'Microsoft'), path.join(pf, 'Eclipse Foundation'), path.join(pf, 'Java')]) {
      if (!fs.existsSync(base)) continue;
      for (const d of fs.readdirSync(base)) {
        if (new RegExp(`jdk-${major}[.-]`, 'i').test(d + '-')) {
          const p = path.join(base, d, 'bin', 'javaw.exe');
          if (fs.existsSync(p)) candidates.push(p);
        }
      }
    }
  } catch {}
  for (const p of candidates) if (p && fs.existsSync(p)) return p;
  return '';
}

async function getRequiredJava(mcVersion) {
  // O JSON da versão diz o Java. Sem rede, deduz pela versão.
  try {
    const m = await (await fetchT('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')).json();
    const v = (m.versions || []).find(x => x.id === mcVersion);
    if (!v) return fallbackJava(mcVersion);
    const j = await (await fetchT(v.url)).json();
    return (j.javaVersion && j.javaVersion.majorVersion) || fallbackJava(mcVersion);
  } catch { return fallbackJava(mcVersion); }
}

const JDK_URLS = {
  8: 'https://api.adoptium.net/v3/binary/latest/8/ga/windows/x64/jdk/hotspot/normal/eclipse',
  17: 'https://aka.ms/download-jdk/microsoft-jdk-17-windows-x64.zip',
  21: 'https://aka.ms/download-jdk/microsoft-jdk-21-windows-x64.zip',
  25: 'https://api.adoptium.net/v3/binary/latest/25/ga/windows/x64/jdk/hotspot/normal/eclipse'
};

// MC 26.x usa SDL3: o JDK 25 completo quebra o load da SDL3.dll dentro da JVM
// (erro 1114, DllMain falha). O JRE 25 do MESMO build carrega normal.
const JRE_URLS = {
  25: 'https://api.adoptium.net/v3/binary/latest/25/ga/windows/x64/jre/hotspot/normal/eclipse'
};

// JRE nunca tem javac; JDK sempre tem. Serve p/ rejeitar JDK 25 no MC 26.x.
function isFullJDK(binDir) {
  try { return fs.existsSync(path.join(binDir, 'javac.exe')); } catch { return false; }
}

function fallbackJava(id) {
  // Sem manifest (snapshot/custom): deduz pela versão
  const m = String(id).match(/^(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!m) return 21;
  const major = +m[1], minor = +m[2], patch = +(m[3] || 0);
  if (major > 1) return 25; // esquema novo (26.x...)
  if (minor <= 16) return 8; // 1.0–1.16
  if (minor === 17) return 17;
  if (minor < 20 || (minor === 20 && patch < 5)) return 17; // 1.18–1.20.4
  return 21; // 1.20.5+
}

async function ensureJava(major = 21) {
  if (major === 16) { major = 17; } // 1.17 roda no 17 (16 morreu, sem build pública boa)
  const found = getBundledJava(major);
  // JDK 25 nem adianta reaproveitar: quebra a SDL3 do MC 26.x (erro 1114)
  if (found && !(major === 25 && isFullJDK(path.dirname(found)))) return found;
  const wantJre = !!JRE_URLS[major];
  const tag = wantJre ? 'jre' : 'jdk';
  const url = wantJre ? JRE_URLS[major] : JDK_URLS[major];
  if (!url) throw new Error(`Java ${major} sem download automático. Instale manual e aponte em Config.`);
  // Baixa Java uma única vez
  const log = (m) => win?.webContents.send('launch-log', m);
  const dir = path.join(userData(), `.${tag}${major}`);
  const javaExe = path.join(dir, 'bin', 'javaw.exe');
  if (fs.existsSync(javaExe)) return javaExe;
  log(`Java ${major} não encontrado. Baixando (só na 1ª vez)...`);
  const zip = path.join(userData(), '.cache', `${tag}${major}.zip`);
  await downloadFile(url, zip, `Java ${major}`);
  log('Extraindo Java...');
  const tmp = path.join(userData(), '.cache', 'jdk-ex');
  fs.rmSync(tmp, { recursive: true, force: true });
  execFileSync('powershell.exe', ['-NoProfile', '-Command', `Expand-Archive -Path '${zip}' -DestinationPath '${tmp}' -Force`], { stdio: 'ignore' });
  const inner = fs.readdirSync(tmp, { withFileTypes: true }).find(d => d.isDirectory());
  if (!inner) throw new Error('Zip do Java inválido');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.renameSync(path.join(tmp, inner.name), dir);
  fs.rmSync(zip, { force: true });
  if (!fs.existsSync(javaExe)) throw new Error('Java extraído mas javaw.exe não achado');
  log(`Java ${major} pronto ✓`);
  return javaExe;
}

function getSettings() {
  const base = loadJson(settingsPath(), null);
  const defaults = {
    ramMin: '2G', ramMax: '4G',
    javaPath: getBundledJava(), // usa JDK local baixado (.jdk21)
    resolution: { width: 854, height: 480 },
    gameDir: path.join(userData(), '.minecraft'),
    version: '26.3',
    loader: 'fabric', // vanilla | fabric | forge | optifine
    overlay: true, // copia obsidian-overlay.jar p/ mods/ automaticamente
    playitSecret: '', // secret do agente playit.gg (tunnel p/ jogar de fora)
    displayMode: 'window', // window | exclusive | borderless
    softwareGL: false, // true = Mesa llvmpipe (sem placa de vídeo, FPS menor)
    autoUpdate: true
  };
  if (!base) return defaults;
  const merged = { ...defaults, ...base, resolution: base.resolution || defaults.resolution };
  if (merged.displayMode === undefined || merged.displayMode === null) {
    merged.displayMode = base.fullscreen ? 'exclusive' : 'window'; // migra config antiga
  }
  return merged;
}

function getOverlayJar() {
  const p = path.join(__dirname, 'overlay-dist', 'obsidian-overlay.jar');
  return fs.existsSync(p) ? p : null;
}

function getOverlayForgeJar() {
  const p = path.join(__dirname, 'overlay-dist', 'obsidian-overlay-forge.jar');
  return fs.existsSync(p) ? p : null;
}

function jarTag(p) {
  // hash curto p/ saber no log qual build entrou no jogo
  try {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').slice(0, 8);
  } catch { return '?'; }
}

function syncOverlayJar(modsDir, srcPath, pattern) {
  // Remove cópias velhas (qualquer nome que bata o padrão) e instala a atual.
  // Sem isso, build velha na pasta vence a nova e o menu nunca muda.
  if (!srcPath || !fs.existsSync(srcPath)) return null;
  fs.mkdirSync(modsDir, { recursive: true });
  const want = path.basename(srcPath);
  let removed = 0;
  for (const f of fs.readdirSync(modsDir)) {
    if (pattern.test(f) && f !== want) {
      try { fs.unlinkSync(path.join(modsDir, f)); removed++; } catch {}
    }
  }
  const dest = path.join(modsDir, want);
  const tag = jarTag(srcPath);
  if (!fs.existsSync(dest) || jarTag(dest) !== tag) {
    fs.copyFileSync(srcPath, dest);
    win?.webContents.send('launch-log', `Overlay atualizado (${tag}) ✓`);
  }
  return { file: dest, tag };
}

async function ensureFabric(root, mcVersion) {
  // Baixa profile Fabric oficial (meta.fabricmc.net) p/ versions/
  const loaders = await (await fetch(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}`)).json();
  if (!loaders?.[0]?.loader?.version) throw new Error('Fabric não tem build p/ ' + mcVersion);
  const loaderVer = loaders[0].loader.version;
  const name = `fabric-loader-${loaderVer}-${mcVersion}`;
  const dir = path.join(root, 'versions', name);
  fs.mkdirSync(dir, { recursive: true });
  const jsonPath = path.join(dir, `${name}.json`);
  if (!fs.existsSync(jsonPath)) {
    const profile = await (await fetch(`https://meta.fabricmc.net/v2/versions/loader/${mcVersion}/${loaderVer}/profile/json`)).json();
    fs.writeFileSync(jsonPath, JSON.stringify(profile));
  }
  return name;
}

function ensureOverlay(root) {
  const r = syncOverlayJar(path.join(root, 'mods'), getOverlayJar(), /^obsidian-overlay(?!-forge).*\.jar$/);
  return r ? r.file : null;
}

function removeOverlayJars(gameDir) {
  // Desligar a overlay tem que TIRAR o .jar da pasta mods/: só pular o sync
  // não adianta, porque a cópia de um lançamento anterior continuaria ativa.
  // Vai p/ .disabled/ (não apaga) p/ voltar sozinho ao reativar.
  const modsDir = path.join(gameDir, 'mods');
  const dis = path.join(modsDir, '.disabled');
  fs.mkdirSync(dis, { recursive: true });
  let gone = 0;
  for (const f of fs.readdirSync(modsDir)) {
    if (/^obsidian-overlay.*\.jar$/i.test(f)) {
      try { fs.renameSync(path.join(modsDir, f), path.join(dis, f)); gone++; } catch {}
    }
  }
  return gone;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1100, height: 720,
    title: 'Obsidian Launcher',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js') }
  });
  // __dirname = project root (dev) ou resources/app (pack, asar desligado)
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  // Espelha o log do jogo em arquivo (diagnóstico remoto)
  try {
    const _send = win.webContents.send.bind(win.webContents);
    win.webContents.send = (ch, ...args) => {
      if (ch === 'launch-log') {
        try { fs.appendFileSync(path.join(userData(), 'launcher.log'), `[${new Date().toISOString()}] ${args[0]}\n`); } catch {}
      }
      return _send(ch, ...args);
    };
  } catch {}
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

// ---------- Auto-update ----------
function setupAutoUpdate(manual = false) {
  try {
    const s = getSettings();
    if (!s.autoUpdate && !manual) return;
    if (!app.isPackaged) return; // dev: não checa update, evita erro ao abrir
    // Build de pasta (--dir) não tem app-update.yml: sem canal de update
    const yml = path.join(process.resourcesPath, 'app-update.yml');
    if (!fs.existsSync(yml)) {
      if (manual) win?.webContents.send('update-status', 'Sem canal de update neste build. Use o instalador (setup) p/ auto-update.');
      return;
    }
    autoUpdater.autoDownload = true;
    autoUpdater.on('update-available', () => win?.webContents.send('update-status', 'Atualização encontrada. Baixando...'));
    autoUpdater.on('download-progress', (p) => win?.webContents.send('update-status', `Baixando update ${Math.round(p.percent || 0)}%...`));
    autoUpdater.on('update-downloaded', () => {
      win?.webContents.send('update-status', 'Atualização pronta ✓');
      win?.webContents.send('update-ready');
    });
    autoUpdater.on('error', (e) => win?.webContents.send('update-status', 'Update: ' + e.message));
    // Só funciona com publish configurado (GitHub Releases). Sem isso, falha silenciosa.
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    // Re-checa a cada 6h com o app aberto
    if (!global._updTimer) global._updTimer = setInterval(() => { try { autoUpdater.checkForUpdatesAndNotify().catch(() => {}); } catch {} }, 6 * 3600 * 1000);
  } catch {}
}

// ---------- IPC ----------
ipcMain.handle('get-settings', () => getSettings());
ipcMain.handle('save-settings', (_, s) => {
  const clean = Object.fromEntries(Object.entries(s || {}).filter(([, v]) => v !== undefined && v !== ''));
  if (s && 'playitSecret' in s) clean.playitSecret = String(s.playitSecret || '').slice(0, 200); // vazio limpa de propósito
  const cur = getSettings();
  saveJson(settingsPath(), { ...cur, ...clean, resolution: s.resolution || cur.resolution });
  return true;
});

ipcMain.handle('get-versions', async () => {
  // TODAS as releases (da mais nova à mais velha), p/ jogar qualquer era
  const res = await fetchT('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
  const j = await res.json();
  return j.versions.filter(v => v.type === 'release').map(v => v.id);
});

ipcMain.handle('get-account', () => {
  const accounts = loadJson(accountsPath(), []);
  if (!accounts[0]) return null;
  const a = accounts[0];
  return { name: a.profile?.name, type: a.type || 'microsoft' };
});

ipcMain.handle('logout', () => { saveJson(accountsPath(), []); return true; });

ipcMain.handle('offline-login', async (_, username) => {
  username = String(username || '').trim();
  if (!/^[A-Za-z0-9_]{3,16}$/.test(username)) throw new Error('Nick inválido: use 3-16 caracteres, só letras/números/_');
  const auth = await Authenticator.getAuth(username);
  const entry = { type: 'offline', profile: { name: username, id: auth.uuid }, auth };
  saveJson(accountsPath(), [entry]);
  return { name: username, type: 'offline' };
});
ipcMain.handle('ms-login', async () => {
  // msmc abre janela Microsoft OAuth. Precisa de clientId Azure. Veja README.
  const { Auth } = require('msmc');
  const authManager = new Auth('select_account');
  // IMPORTANTE: troque pelo seu Azure App clientId
  const clientId = process.env.MSMC_CLIENT_ID || 'SEU-CLIENT-ID-AZURE';
  authManager.setClientId(clientId);
  const xboxManager = await authManager.launch('electron');
  const token = await xboxManager.getMinecraft();
  const profile = await token.getProfile();
  // token.mclc() retorna objeto compatível com minecraft-launcher-core
  const entry = { type: 'microsoft', profile: { id: profile.id, name: profile.name }, mclc: token.mclc() };
  saveJson(accountsPath(), [entry]);
  return { name: profile.name, id: profile.id, type: 'microsoft' };
});

let launching = false;
ipcMain.handle('launch', async (_, opts = {}) => {
  if (launching) throw new Error('Jogo já iniciando, aguarde...');
  launching = true;
  try {
  const settings = { ...getSettings(), ...opts };
  const accounts = loadJson(accountsPath(), []);
  if (!accounts[0]) throw new Error('Faça login (Microsoft ou offline) primeiro.');
  const acc = accounts[0];
  const authorization = acc.type === 'offline' ? acc.auth : acc.mclc;
  if (!authorization) throw new Error('Conta inválida, faça login de novo.');
  win?.webContents.send('launch-log', `[1/4] Conta: ${acc.profile?.name || acc.profile?.id} (${acc.type}) ✓`);
  const launcher = new Client();
  launcher.on('debug', (e) => win?.webContents.send('launch-log', '[debug] ' + e));
  launcher.on('data', (e) => win?.webContents.send('launch-log', e));
  launcher.on('progress', (e) => win?.webContents.send('launch-progress', e));
  launcher.on('close', (code) => win?.webContents.send('game-closed', code));

  // Tela: janela | exclusiva (--fullscreen, não aparece em lives) | borderless (enche a tela e aparece em live)
  let winOpt = { width: settings.resolution.width, height: settings.resolution.height };
  if (settings.displayMode === 'exclusive') {
    winOpt = { width: settings.resolution.width, height: settings.resolution.height, fullscreen: true };
  } else if (settings.displayMode === 'borderless') {
    try {
      const sz = screen.getPrimaryDisplay().size;
      winOpt = { width: sz.width, height: sz.height };
    } catch {}
    win?.webContents.send('launch-log', `Modo borderless ${winOpt.width}x${winOpt.height} (capturável em live) ✓`);
  }
  const launchOpts = {
    clientPackage: null,
    authorization,
    root: settings.gameDir,
    version: { number: settings.version, type: 'release' },
    memory: { max: settings.ramMax, min: settings.ramMin },
    window: winOpt,
    overrides: { detached: true } // jogo sobrevive se fechar o launcher
  };
  // Java: config > provisionado > PATH; se nada, baixa Microsoft JDK 21

  // GPU: sem driver de vídeo real o GLFW não cria a janela (erro 0x10006)
  let gpuProbe = '';
  try {
    const out = execSync('powershell.exe -NoProfile -Command "Get-CimInstance Win32_VideoController | ForEach-Object { $_.Name + \' | driver \' + $_.DriverVersion + \' | \' + $_.Status }"', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 }).trim();
    gpuProbe = out;
    for (const line of out.split('\n')) win?.webContents.send('launch-log', 'GPU: ' + line.trim());
    if (/basic display|padrão|standard vga|llvmpipe/i.test(out) || !out) {
      win?.webContents.send('launch-log', 'AVISO: sem driver de vídeo instalado! O jogo pode falhar (GLFW/OpenGL). Instale o driver NVIDIA/AMD/Intel.');
    }
    if ((out.match(/\n/g) || []).length >= 1) {
      win?.webContents.send('launch-log', 'Dica: 2 GPUs detectadas (notebook?). Se falhar, force o javaw.exe na GPU dedicada em Configurações do Windows > Tela > Gráficos.');
    }
  } catch {}
  if (gpuProbe && settings.softwareGL
      && /nvidia|geforce|amd|radeon|intel/i.test(gpuProbe)
      && !/basic|padrao|padrão|standard vga|llvmpipe/i.test(gpuProbe)) {
    // GPU real com driver: o Mesa (modo compatibilidade) matava o jogo no
    // EarlyDisplay. Desliga de vez, mesmo se a caixinha ficou marcada na tela.
    settings.softwareGL = false;
    try { saveJson(settingsPath(), { ...getSettings(), softwareGL: false }); } catch {}
    win?.webContents.send('launch-log', 'GPU com driver detectada: modo compatibilidade DESLIGADO.');
  }
  // Java certo p/ a versão (1.21.x=21, 26.x=25)
  const javaMajor = await getRequiredJava(settings.version);
  win?.webContents.send('launch-log', `[2/4] Java ${javaMajor} p/ ${settings.version}`);
  const probeMajor = (p) => {
    try {
      const out = execFileSync(`"${p}"`, ['-version'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 15000 });
      const m = String(out + '').match(/version "(\d+)/);
      return m ? +m[1] : null;
    } catch { return null; }
  };
  let javaPath = '';
  if (settings.javaPath && fs.existsSync(settings.javaPath) && probeMajor(settings.javaPath) === javaMajor) {
    javaPath = settings.javaPath;
  }
  if (javaMajor === 25 && javaPath && isFullJDK(path.dirname(javaPath))) {
    // JDK 25 (qualquer vendor/build) quebra a SDL3 do MC 26.x: erro 1114.
    // O JRE 25 do mesmo build funciona — força a troca e avisa no log.
    win?.webContents.send('launch-log', 'JDK 25 rejeitado (incompatível com MC 26.x, SDL3 erro 1114). Trocando por JRE 25...');
    javaPath = '';
  }
  if (!javaPath) {
    win?.webContents.send('launch-log', 'Procurando Java...');
    javaPath = await ensureJava(javaMajor);
    if (javaPath) saveJson(settingsPath(), { ...getSettings(), javaPath, javaMajor });
  }
  if (!javaPath) throw new Error(`Java ${javaMajor} não encontrado. Instale ou aponte o caminho em Config.`);
  launchOpts.javaPath = javaPath;
  await applySoftwareGL(javaPath, !!settings.softwareGL);
  // Separa mods por loader/versão: mistura (Fabric+Forge+OptiFine) crasha o jogo
  win?.webContents.send('launch-log', '[3/4] Verificando mods...');
  quarantineMods(settings.gameDir, settings.version, settings.loader);
  if (opts.server && opts.server.host) {
    launchOpts.quickPlay = { type: 'multiplayer', identifier: `${opts.server.host}:${opts.server.port || 25565}` };
    win?.webContents.send('launch-log', `Entrada rápida: ${opts.server.host}:${opts.server.port || 25565}`);
  }
  if (settings.loader === 'fabric') {
    win?.webContents.send('launch-log', 'Instalando Fabric...');
    const custom = await ensureFabric(settings.gameDir, settings.version);
    launchOpts.version = { number: settings.version, type: 'release', custom };
    await ensureFabricApi(settings.gameDir, settings.version);
    if (acc.type === 'offline') await ensureStraySkins(settings.gameDir, settings.version);
    // Overlay foi compilado p/ 1.21: em outra versão ele crasharia o jogo
    if (settings.overlay && /^1\.21(\.|$)/.test(settings.version)) {
      const o = ensureOverlay(settings.gameDir);
      win?.webContents.send('launch-log', o ? 'Overlay Obsidian ativo ✓' : 'Overlay .jar não encontrado (rode build do obsidian-mod)');
    } else {
      const gone = removeOverlayJars(settings.gameDir);
      win?.webContents.send('launch-log', settings.overlay
        ? 'Overlay só existe p/ 1.21 (removido p/ não crashar) — resto funciona normal.'
        : `Overlay Obsidian desativado${gone ? ' (mod removido da pasta)' : ''} ✓`);
    }
  } else if (settings.loader === 'forge' || settings.loader === 'optifine') {
    if (settings.loader === 'optifine') {
      win?.webContents.send('launch-log', 'Instalando par Forge+OptiFine...');
      launchOpts.forge = (await ensureOptiFine(settings.gameDir, settings.version)).forgeInstaller;
    } else {
      win?.webContents.send('launch-log', 'Instalando Forge...');
      launchOpts.forge = await ensureForge(settings.gameDir, settings.version);
    }
    if (settings.overlay && settings.version === '1.21.1') {
      // Overlay Forge (mesmo menu/HUD/amigos do Fabric)
      const r = syncOverlayJar(path.join(settings.gameDir, 'mods'), getOverlayForgeJar(), /^obsidian-overlay-forge.*\.jar$/);
      win?.webContents.send('launch-log', r ? `Overlay Obsidian (Forge ${r.tag}) ativo ✓` : 'Overlay .jar não encontrado (rode build do obsidian-mod-forge)');
    } else {
      const gone = removeOverlayJars(settings.gameDir);
      win?.webContents.send('launch-log', settings.overlay
        ? 'Overlay Forge só existe p/ 1.21.1 (removido p/ não crashar) — resto funciona normal.'
        : `Overlay Obsidian desativado${gone ? ' (mod removido da pasta)' : ''} ✓`);
    }
  }

  win?.webContents.send('launch-log', `[4/4] Iniciando Minecraft ${settings.version} (${settings.loader})...`);
  win?.webContents.send('launch-log', 'O jogo abre em outra janela. Na 1ª vez pode demorar ATÉ 5 MINUTOS (tela branca = carregando). Não feche!');
  // Temp único por execução: 2 cliques rápidos extraíam natives/SDL no mesmo
  // lugar e um deles carregava DLL pela metade (UnsatisfiedLinkError 1114)
  const runTmp = path.join(userData(), '.run-tmp', String(Date.now()));
  fs.mkdirSync(runTmp, { recursive: true });
  launchOpts.customArgs = [`-Djava.io.tmpdir=${runTmp}`];
  try {
    const base = path.join(userData(), '.run-tmp');
    for (const d of fs.readdirSync(base)) {
      if (/^\d+$/.test(d) && Date.now() - +d > 86400000) fs.rmSync(path.join(base, d), { recursive: true, force: true });
    }
  } catch {}
  try {
    await launcher.launch(launchOpts);
  } finally {
    launching = false;
  }
  win?.webContents.send('game-started');
  return true;
  } finally {
    launching = false;
  }
});

ipcMain.handle('stop-game', () => {
  // Mata só o javaw do NOSSO gameDir (não mexe em outros javas)
  const root = getSettings().gameDir.toLowerCase();
  let killed = 0;
  try {
    const ps = path.join(userData(), '.cache', 'stop-game.ps1');
    fs.mkdirSync(path.dirname(ps), { recursive: true });
    fs.writeFileSync(ps, `Get-CimInstance Win32_Process -Filter "Name='javaw.exe'" | Select-Object ProcessId,CommandLine | ConvertTo-Json`);
    const out = execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 });
    const list = JSON.parse(out || '[]');
    for (const p of Array.isArray(list) ? list : [list]) {
      if (p && p.CommandLine && String(p.CommandLine).toLowerCase().includes(root)) {
        try { process.kill(p.ProcessId, 'SIGKILL'); killed++; } catch {}
      }
    }
  } catch {}
  win?.webContents.send('launch-log', killed ? `Jogo parado (${killed}) ✓` : 'Nenhum jogo rodando.');
  win?.webContents.send('game-closed', 'stopped');
  return { killed };
});

async function ensureFabricApi(root, mcVersion) {
  // Sem Fabric API nenhum mod de Fabric carrega (inclui o overlay)
  const log = (m) => win?.webContents.send('launch-log', m);
  const url = `https://api.modrinth.com/v2/project/P7dR8mSH/version?loaders=${JSON.stringify(['fabric'])}&game_versions=${JSON.stringify([mcVersion])}&limit=3`;
  const r = await fetch(url, { headers: { 'User-Agent': 'ObsidianLauncher/0.2' } });
  if (!r.ok) { log('Aviso: não achei Fabric API p/ ' + mcVersion); return null; }
  const versions = await r.json();
  const ver = (versions || []).find(v => (v.files || []).some(f => f.primary)) || versions[0];
  if (!ver) return null;
  const file = (ver.files || []).find(f => f.primary) || ver.files[0];
  const mods = path.join(root, 'mods');
  fs.mkdirSync(mods, { recursive: true });
  const dest = path.join(mods, file.filename);
  if (fs.existsSync(dest)) { log('Fabric API ok ✓'); return dest; }
  for (const f of fs.readdirSync(mods)) {
    if (/^fabric-api-.*\.jar$/.test(f)) fs.unlinkSync(path.join(mods, f));
  }
  log(`Baixando Fabric API ${ver.version_number}...`);
  const dl = await fetch(file.url);
  if (!dl.ok) throw new Error('Download Fabric API falhou: ' + dl.status);
  fs.writeFileSync(dest, Buffer.from(await dl.arrayBuffer()));
  log('Fabric API instalada ✓');
  return dest;
}

let _ofTable = null;
// Pares COMPROVADOS em jogo (tabela oficial nem sempre acerta o mundo real)
const PROVEN_FORGE = { '1.21.1': '52.1.14' };
async function scrapeOptiFineTable() {
  // A tabela do optifine.net diz o Forge compatível de cada OptiFine/MC.
  // Ex: 1.21.1 -> OptiFine_1.21.1_HD_U_J1.jar + Forge 52.0.16
  if (_ofTable) return _ofTable;
  const page = await (await fetch('https://optifine.net/downloads', { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
  const table = {};
  for (const [, mc, body] of page.matchAll(/<h2>Minecraft ([\d.]+)\s*<\/h2>([\s\S]*?)(?=<h2>|$)/g)) {
    const rows = [...body.matchAll(/<tr class='downloadLine([^']*)'>[\s\S]*?colFile'>([^<]+)<[\s\S]*?adloadx\?f=([^'")\s&]+)[\s\S]*?colForge'>([^<]*)</g)];
    const main = rows.find(r => (r[1] || '').includes('downloadLineMain'));
    if (main) table[mc] = { name: main[2].trim(), file: main[3].trim(), forge: (main[4].trim().match(/[\d.]+/) || [])[0] || null };
  }
  _ofTable = table;
  return table;
}

function jarKind(p) {
  try {
    const AdmZip = require('adm-zip');
    const names = new AdmZip(p).getEntries().map(e => e.entryName);
    return { fabric: names.includes('fabric.mod.json'), forge: names.includes('META-INF/mods.toml') };
  } catch { return { fabric: false, forge: false }; }
}

function cmpMc(a, b) {
  // compara versões MC numericamente ignorando sufixos (-pre etc)
  const pa = String(a).split('-')[0].split('.').map(Number);
  const pb = String(b).split('-')[0].split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}
function satisfiesMc(range, mc) {
  // AND por espaço/vírgula, OR por ||. Operadores: >= <= > < = ~ ^, x, *
  const orGroups = String(range).split('||').map(s => s.trim()).filter(Boolean);
  if (!orGroups.length) return true;
  return orGroups.some(group => {
    const comps = group.split(/[\s,]+/).filter(Boolean);
    if (!comps.length) return true;
    return comps.every(c => {
      if (c === '*' || c === 'x') return true;
      const m = c.match(/^(>=|<=|>|<|=|~|\^)?(\d+(?:\.\d+)*(?:\.x)?)$/);
      if (!m) return true; // formato desconhecido: mantém
      const [, op = '=', ver] = m;
      const clean = ver.replace(/\.x$/, '');
      const parts = clean.split('.').length;
      if (op === '~') { // ~1.21 / ~1.21.1 => >=clean <major.(minor+1)
        const cap = `${clean.split('.')[0]}.${(+(clean.split('.')[1] || 0)) + 1}`;
        return cmpMc(mc, clean) >= 0 && cmpMc(mc, cap) < 0;
      }
      if (op === '^') return cmpMc(mc, clean) >= 0 && cmpMc(mc, `${+clean.split('.')[0] + 1}`) < 0;
      if (!op || op === '=') {
        if (ver.endsWith('.x') || parts < 3) {
          const prefix = ver.replace(/\.x$/, '');
          return mc === prefix || mc.startsWith(prefix + '.');
        }
        return cmpMc(mc, clean) === 0;
      }
      const d = cmpMc(mc, clean);
      return op === '>=' ? d >= 0 : op === '<=' ? d <= 0 : op === '>' ? d > 0 : d < 0;
    });
  });
}
function fabricMcOk(p, mc) {
  // Lê depends.minecraft do fabric.mod.json; sem info, mantém
  try {
    const AdmZip = require('adm-zip');
    const j = JSON.parse(new AdmZip(p).readAsText('fabric.mod.json'));
    let dep = j.depends && j.depends.minecraft;
    if (!dep) return true;
    if (Array.isArray(dep)) dep = dep.join(' ');
    return satisfiesMc(dep, mc);
  } catch { return true; }
}

function quarantineMods(root, mc, loader) {
  // Uma pasta mods/ para todos os loaders mistura jars incompatíveis e crasha.
  // Move o que não serve p/ mods/.disabled/ e restaura o que serve.
  const log = (m) => win?.webContents.send('launch-log', m);
  const mods = path.join(root, 'mods');
  const dis = path.join(mods, '.disabled');
  fs.mkdirSync(mods, { recursive: true });
  fs.mkdirSync(dis, { recursive: true });
  const ofMc = (n) => { const m = n.match(/^(?:preview_)?OptiFine_([\d.]+)_HD_U_.*\.jar$/); return m ? m[1] : null; };
  const keep = (dir, name) => {
    const full = path.join(dir, name);
    if (!/\.jar$/i.test(name)) return false;
    const omc = ofMc(name);
    if (omc) return loader === 'forge' || loader === 'optifine' ? omc === mc : false;
    const k = jarKind(full);
    if (loader === 'vanilla') return false;
    if (loader === 'fabric') return k.fabric && fabricMcOk(full, mc);
    if (loader === 'forge' || loader === 'optifine') return k.forge && !k.fabric;
    return false;
  };
  const moved = [];
  for (const f of fs.readdirSync(mods)) {
    if (f === '.disabled') continue;
    if (!keep(mods, f)) { fs.renameSync(path.join(mods, f), path.join(dis, f)); moved.push(f); }
  }
  const back = [];
  for (const f of fs.readdirSync(dis)) {
    if (keep(dis, f)) { fs.renameSync(path.join(dis, f), path.join(mods, f)); back.push(f); }
  }
  if (moved.length) log(`Mods incompatíveis guardados (${moved.length}): ${moved.slice(0, 3).join(', ')}${moved.length > 3 ? '...' : ''}`);
  if (back.length) log(`Mods restaurados (${back.length}) ✓`);
}

async function ensureForge(root, mcVersion, pinned = null) {
  const log = (m) => win?.webContents.send('launch-log', m);
  let forgeVer = pinned;
  if (!forgeVer) {
    const promos = await (await fetch('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json')).json();
    forgeVer = (promos.promos || {})[`${mcVersion}-recommended`] || (promos.promos || {})[`${mcVersion}-latest`];
  }
  if (!forgeVer) throw new Error(`Forge não tem build p/ ${mcVersion}. Use 1.20.1 ou 1.21.1.`);
  const file = `forge-${mcVersion}-${forgeVer}-installer.jar`;
  const dir = path.join(root, 'forge-installers');
  fs.mkdirSync(dir, { recursive: true });
  const dest = path.join(dir, file);
  if (!fs.existsSync(dest)) {
    log(`Baixando Forge ${forgeVer}...`);
    const dl = await fetch(`https://maven.minecraftforge.net/net/minecraftforge/forge/${mcVersion}-${forgeVer}/${file}`);
    if (!dl.ok) throw new Error('Download Forge falhou: ' + dl.status);
    fs.writeFileSync(dest, Buffer.from(await dl.arrayBuffer()));
  }
  // Invalida cache do MCLC se trocou a versão do installer
  const cache = path.join(root, 'forge', mcVersion);
  const stamp = path.join(cache, 'installer.version');
  try {
    if (fs.readFileSync(stamp, 'utf8') !== file) fs.rmSync(cache, { recursive: true, force: true });
  } catch { try { fs.rmSync(cache, { recursive: true, force: true }); } catch {} }
  fs.mkdirSync(cache, { recursive: true });
  fs.writeFileSync(stamp, file);
  log(`Forge ${forgeVer} pronto ✓`);
  return dest;
}

async function ensureOptiFine(root, mcVersion) {
  // Usa a tabela oficial: cada OptiFine tem UM Forge compatível.
  // Forge "latest" + OptiFine errado = NoSuchMethodError e crash no mundo.
  const log = (m) => win?.webContents.send('launch-log', m);
  const table = await scrapeOptiFineTable();
  const row = table[mcVersion];
  if (!row || !row.forge) {
    const ok = Object.keys(table).join(', ');
    throw new Error(`OptiFine estável não tem build p/ ${mcVersion} (só previews, sem Forge). Use: ${ok}`);
  }
  const forgeVer = PROVEN_FORGE[mcVersion] || row.forge;
  log(`Par oficial: OptiFine ${row.name} + Forge ${forgeVer}`);
  const forgeInstaller = await ensureForge(root, mcVersion, forgeVer);
  const mods = path.join(root, 'mods');
  fs.mkdirSync(mods, { recursive: true });
  const dest = path.join(mods, row.file);
  if (fs.existsSync(dest)) { log('OptiFine ok ✓'); return { dest, forgeInstaller }; }
  log(`Baixando ${row.file}...`);
  const dlBuf = async () => {
    const ad = await (await fetch(`https://optifine.net/adloadx?f=${row.file}`, { headers: { 'User-Agent': 'Mozilla/5.0' } })).text();
    const link = ad.match(/downloadx\?f=[^'"\s]+/);
    if (!link) return null;
    const dl = await fetch('https://optifine.net/' + link[0], { headers: { 'User-Agent': 'Mozilla/5.0', Referer: `https://optifine.net/adloadx?f=${row.file}` } });
    if (!dl.ok) return null;
    const buf = Buffer.from(await dl.arrayBuffer());
    if (buf.length > 1024 * 1024 && buf[0] === 0x50 && buf[1] === 0x4B) return buf;
    return null;
  };
  const buf = await dlBuf();
  if (!buf) throw new Error('OptiFine recusou o download. Baixe manual em optifine.net e jogue o .jar em mods/');
  fs.writeFileSync(dest, buf);
  log('OptiFine instalado ✓ (vai como mod do Forge)');
  return { dest, forgeInstaller };
}

ipcMain.handle('search-modrinth', async (_, query, loader, mcVersion, kind = 'mod') => {
  // kind: mod | shader | resourcepack | modpack
  const typeMap = { mod: 'mod', shader: 'shader', resourcepack: 'resourcepack', modpack: 'modpack' };
  const facets = [[`project_type:${typeMap[kind] || 'mod'}`], [`versions:${mcVersion}`]];
  if (kind === 'mod') facets.push([`categories:${(loader === 'forge' || loader === 'optifine') ? 'forge' : 'fabric'}`]);
  const url = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&facets=${encodeURIComponent(JSON.stringify(facets))}&limit=20`;
  const r = await fetch(url, { headers: { 'User-Agent': 'ObsidianLauncher/0.2' } });
  return r.json();
});

const CONTENT_DIRS = { mod: 'mods', shader: 'shaderpacks', resourcepack: 'resourcepacks', modpack: 'modpacks' };
const CONTENT_EXTS = { mod: ['.jar'], shader: ['.zip', '.jar'], resourcepack: ['.zip'], modpack: ['.mrpack'] };

function getContentDir(kind) {
  const d = path.join(getSettings().gameDir, CONTENT_DIRS[kind] || 'mods');
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function getModsDir() { return getContentDir('mod'); }

ipcMain.handle('mods-list', () => {
  const dir = getModsDir();
  return fs.readdirSync(dir).filter(f => f.endsWith('.jar')).map(f => {
    const st = fs.statSync(path.join(dir, f));
    return { name: f, size: st.size };
  });
});

ipcMain.handle('content-list', (_, kind) => {
  const dir = getContentDir(kind);
  const exts = CONTENT_EXTS[kind] || ['.jar'];
  return fs.readdirSync(dir).filter(f => exts.some(e => f.endsWith(e))).map(f => {
    const st = fs.statSync(path.join(dir, f));
    return { name: f, size: st.size };
  });
});

ipcMain.handle('open-mods-folder', async () => {
  await shell.openPath(getModsDir());
  return true;
});

ipcMain.handle('open-content-folder', async (_, kind) => {
  await shell.openPath(getContentDir(kind));
  return true;
});

ipcMain.handle('friend-sync', (_, data) => {
  // Espelha sala/membros p/ o mod ler no jogo (<gameDir>/obsidian/friends.json)
  try {
    const dir = path.join(getSettings().gameDir, 'obsidian');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'friends.json'), JSON.stringify({ room: data?.room || '', members: data?.members || [], at: Date.now() }));
  } catch {}
  return true;
});

ipcMain.handle('open-game-dir', async () => {
  const d = getSettings().gameDir;
  fs.mkdirSync(d, { recursive: true });
  await shell.openPath(d);
  return true;
});

ipcMain.handle('last-crash', () => {
  const dir = path.join(getSettings().gameDir, 'crash-reports');
  if (!fs.existsSync(dir)) return { file: null, head: 'Sem pasta crash-reports (sem crash registrado). Veja logs/latest.log na pasta do jogo.' };
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt'))
    .map(f => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  if (!files.length) return { file: null, head: 'Sem crash-reports.' };
  const full = fs.readFileSync(path.join(dir, files[0].f), 'utf8');
  return { file: files[0].f, head: full.split('\n').slice(0, 45).join('\n') };
});

ipcMain.handle('mod-delete', (_, name) => {
  const p = path.join(getModsDir(), path.basename(name));
  if (fs.existsSync(p)) fs.unlinkSync(p);
  return true;
});

ipcMain.handle('content-delete', (_, kind, name) => {
  const p = path.join(getContentDir(kind), path.basename(name));
  if (fs.existsSync(p)) fs.unlinkSync(p);
  return true;
});

async function downloadModrinthFile(projectId, loader, mcVersion, kind) {
  const isPack = kind === 'modpack';
  // Só mods usam filtro de loader (fabric/forge). Shaders/texturas usam
  // loaders próprios (iris/optifine/minecraft) — filtrar só por versão do jogo.
  let url = `https://api.modrinth.com/v2/project/${projectId}/version?game_versions=${JSON.stringify([mcVersion])}&limit=10`;
  if (kind === 'mod') url += `&loaders=${JSON.stringify([(loader === 'forge' || loader === 'optifine') ? 'forge' : 'fabric'])}`;
  const r = await fetch(url, { headers: { 'User-Agent': 'ObsidianLauncher/0.2' } });
  if (!r.ok) throw new Error('Sem build para MC ' + mcVersion + (kind === 'mod' ? ' (' + loader + ')' : ''));
  const versions = await r.json();
  if (!versions?.length) throw new Error(`Sem build para MC ${mcVersion} — tente outra versão no Jogar`);
  const ver = (versions || []).find(v => (v.files || []).some(f => f.primary)) || versions[0];
  if (!ver) throw new Error('Nenhuma versão encontrada');
  const file = (ver.files || []).find(f => f.primary) || ver.files[0];
  if (!file) throw new Error('Arquivo inválido');
  return { version: ver.version_number, mc: (ver.game_versions || []).join(','), file };
}

ipcMain.handle('mod-download', async (_, projectId, loader, mcVersion) => {
  const { version, mc, file } = await downloadModrinthFile(projectId, loader, mcVersion, 'mod');
  const dest = path.join(getModsDir(), file.filename);
  if (fs.existsSync(dest)) return { file: file.filename, version, mc, skipped: true };
  const dl = await fetch(file.url);
  if (!dl.ok) throw new Error('Download falhou: ' + dl.status);
  fs.writeFileSync(dest, Buffer.from(await dl.arrayBuffer()));
  win?.webContents.send('launch-log', `Mod instalado: ${file.filename} (v${version} • MC ${mc || mcVersion})`);
  return { file: file.filename, version, mc, skipped: false };
});

ipcMain.handle('content-download', async (_, kind, projectId, loader, mcVersion) => {
  if (kind === 'modpack') return installModpack(projectId, mcVersion);
  const { version, mc, file } = await downloadModrinthFile(projectId, loader, mcVersion, kind);
  const dest = path.join(getContentDir(kind), file.filename);
  if (fs.existsSync(dest)) return { file: file.filename, version, mc, skipped: true };
  const dl = await fetch(file.url);
  if (!dl.ok) throw new Error('Download falhou: ' + dl.status);
  fs.writeFileSync(dest, Buffer.from(await dl.arrayBuffer()));
  const label = { shader: 'Shader', resourcepack: 'Resource pack' }[kind] || 'Arquivo';
  win?.webContents.send('launch-log', `${label} instalado: ${file.filename} (v${version})`);
  return { file: file.filename, version, mc, skipped: false };
});

// ---------- Modpack do servidor (código p/ quem for entrar) ----------
function getServerModpack(s) {
  return { loader: s.modLoader || 'fabric', game: s.modMc || s.version, mods: Array.isArray(s.modpack) ? s.modpack : [] };
}
ipcMain.handle('server-modpack-get', (_, id) => {
  const s = loadServers().find(x => x.id === id);
  if (!s) throw new Error('Servidor não encontrado.');
  const mp = getServerModpack(s);
  return { loader: mp.loader, game: mp.game, mods: mp.mods };
});
ipcMain.handle('server-modpack-meta', (_, id, loader, mcVersion) => {
  const list = loadServers();
  const s = list.find(x => x.id === id);
  if (!s) throw new Error('Servidor não encontrado.');
  s.modLoader = loader === 'forge' ? 'forge' : 'fabric';
  if (mcVersion) s.modMc = String(mcVersion).slice(0, 20);
  saveServers(list);
  return true;
});
ipcMain.handle('server-modpack-add', async (_, id, projectId, loader, mcVersion) => {
  const list = loadServers();
  const s = list.find(x => x.id === id);
  if (!s) throw new Error('Servidor não encontrado.');
  s.modLoader = loader === 'forge' ? 'forge' : 'fabric';
  if (mcVersion) s.modMc = String(mcVersion).slice(0, 20);
  s.modpack = Array.isArray(s.modpack) ? s.modpack : [];
  if (!s.modpack.some(m => m.project_id === projectId)) {
    const p = await (await fetch(`https://api.modrinth.com/v2/project/${projectId}`, { headers: { 'User-Agent': 'ObsidianLauncher/0.2' } })).json();
    s.modpack.push({ project_id: projectId, title: p.title || projectId });
    saveServers(list);
  }
  return { mods: s.modpack };
});
ipcMain.handle('server-modpack-remove', (_, id, projectId) => {
  const list = loadServers();
  const s = list.find(x => x.id === id);
  if (!s) throw new Error('Servidor não encontrado.');
  s.modpack = (Array.isArray(s.modpack) ? s.modpack : []).filter(m => m.project_id !== projectId);
  saveServers(list);
  return { mods: s.modpack };
});
ipcMain.handle('server-modpack-code', (_, id) => {
  const s = loadServers().find(x => x.id === id);
  if (!s) throw new Error('Servidor não encontrado.');
  const mp = getServerModpack(s);
  if (!mp.mods.length) throw new Error('Lista vazia: adicione mods primeiro.');
  const payload = { v: 1, game: mp.game, loader: mp.loader, mods: mp.mods.map(m => m.project_id) };
  return { code: 'OBM1.' + Buffer.from(JSON.stringify(payload)).toString('base64url'), count: payload.mods.length };
});
ipcMain.handle('modpack-install-code', async (_, code) => {
  const raw = String(code || '').trim();
  if (!raw.startsWith('OBM1.')) throw new Error('Código inválido (começa com OBM1.)');
  let payload;
  try { payload = JSON.parse(Buffer.from(raw.slice(5), 'base64url').toString('utf8')); }
  catch { throw new Error('Código inválido.'); }
  if (!payload || !Array.isArray(payload.mods)) throw new Error('Código inválido.');
  const ok = [], fail = [];
  for (const pid of payload.mods.slice(0, 60)) {
    try {
      const { file } = await downloadModrinthFile(pid, payload.loader, payload.game, 'mod');
      const dest = path.join(getModsDir(), file.filename);
      if (!fs.existsSync(dest)) {
        const dl = await fetch(file.url);
        if (!dl.ok) throw new Error('HTTP ' + dl.status);
        fs.writeFileSync(dest, Buffer.from(await dl.arrayBuffer()));
      }
      ok.push(file.filename);
    } catch (e) { fail.push(pid + ': ' + e.message); }
  }
  return { ok, fail, game: payload.game, loader: payload.loader };
});

async function installModpack(projectId, mcVersion) {
  // Baixa .mrpack e instala: arquivos -> mods/, overrides -> pasta do jogo
  const AdmZip = require('adm-zip');
  const { version, file } = await downloadModrinthFile(projectId, 'fabric', mcVersion, 'modpack');
  const dir = getContentDir('modpack');
  const mrpack = path.join(dir, file.filename);
  const log = (m) => win?.webContents.send('launch-log', m);
  if (!fs.existsSync(mrpack)) {
    log(`Baixando modpack ${file.filename}...`);
    const dl = await fetch(file.url);
    if (!dl.ok) throw new Error('Download falhou: ' + dl.status);
    fs.writeFileSync(mrpack, Buffer.from(await dl.arrayBuffer()));
  }
  const zip = new AdmZip(mrpack);
  const indexEntry = zip.getEntry('modrinth.index.json');
  if (!indexEntry) throw new Error('.mrpack inválido (sem modrinth.index.json)');
  const index = JSON.parse(zip.readAsText(indexEntry));
  const root = getSettings().gameDir;
  let n = 0;
  for (const f of index.files || []) {
    const target = path.join(root, f.path.replace(/\//g, path.sep));
    if (fs.existsSync(target)) continue;
    const url = (f.downloads || [])[0];
    if (!url) continue;
    log(`Modpack: baixando ${f.path} (${++n}/${index.files.length})...`);
    const dl = await fetch(url);
    if (!dl.ok) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, Buffer.from(await dl.arrayBuffer()));
  }
  // overrides/ -> raiz do jogo
  for (const e of zip.getEntries()) {
    if (!e.entryName.startsWith('overrides/') || e.isDirectory) continue;
    const target = path.join(root, e.entryName.slice('overrides/'.length).replace(/\//g, path.sep));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, zip.readFile(e));
  }
  log(`Modpack ${file.filename} instalado ✓ (${n} arquivos)`);
  return { file: file.filename, version, mc: mcVersion, skipped: false };
}

ipcMain.handle('check-update', () => { setupAutoUpdate(true); return true; });
ipcMain.handle('quit-and-install', () => { try { autoUpdater.quitAndInstall(); } catch {} return true; });

// ---------- Minecraft Bedrock (Store) ----------
// Bedrock PC = app da Microsoft Store (conta Xbox, sem modo offline).
ipcMain.handle('bedrock-status', () => {
  try {
    const out = execSync('powershell.exe -NoProfile -Command "(Get-AppxPackage Microsoft.MinecraftUWP | Select-Object -First 1 Version,InstallLocation | ConvertTo-Json -Compress)"', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 20000 }).trim();
    if (!out) return { installed: false };
    const j = JSON.parse(out);
    return { installed: true, version: `${j.Version.Major}.${j.Version.Minor}.${j.Version.Build}` };
  } catch { return { installed: false }; }
});
ipcMain.handle('bedrock-launch', async () => {
  await shell.openExternal('minecraft://');
  return true;
});

// ---------- Servidores (MC Java + Hytale via SteamCMD + custom) ----------
const serversPath = () => path.join(userData(), 'servers.json');
function loadServers() { try { const a = JSON.parse(fs.readFileSync(serversPath(), 'utf8')); return Array.isArray(a) ? a : []; } catch { return []; } }
function saveServers(s) { fs.mkdirSync(path.dirname(serversPath()), { recursive: true }); fs.writeFileSync(serversPath(), JSON.stringify(s, null, 2)); }
const runningServers = new Map(); // id -> {proc, log:[]}

function serverDir(s) { return s.dir || path.join(userData(), 'servers', s.id); }
function slog(id, line) {
  const r = runningServers.get(id);
  const text = String(line).replace(/\r/g, '').slice(0, 500);
  if (r) { r.log.push(text); if (r.log.length > 400) r.log.splice(0, r.log.length - 400); }
  win?.webContents.send('server-log', { id, line: text });
}

function lanIP() {
  // IP da rede local p/ sugerir como endereço de entrada (celular/outro PC no Wi-Fi)
  try {
    for (const nets of Object.values(os.networkInterfaces())) {
      for (const n of nets || []) {
        if (n.family === 'IPv4' && !n.internal && /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))\./.test(n.address)) return n.address;
      }
    }
  } catch {}
  return '';
}
ipcMain.handle('servers-list', () => {
  const lan = lanIP();
  return loadServers().map(s => ({ ...s,
    running: runningServers.has(s.id),
    external: runningServers.get(s.id)?.external || '',
    tunnels: playit.status().addresses,
    lan: lan ? lan + (s.port === 25565 ? '' : ':' + s.port) : ''
  }));
});

async function exposeUpnp(id, s) {
  // Roteador com UPnP abre a porta sozinho; sem UPnP só avisa no console
  // (não é erro: na mesma rede continua funcionando normal).
  const port = +s.port;
  if (!Number.isFinite(port) || port <= 0 || port > 65535) return;
  const lan = lanIP();
  if (!lan || !runningServers.get(id)) return;
  try {
    slog(id, 'UPnP: pedindo abertura da porta ao roteador...');
    const m = await upnp.mapPort({ publicPort: port, privatePort: port, lan, description: `Obsidian ${s.name}` });
    const r = runningServers.get(id);
    if (!r) { try { await upnp.unmapPort({ publicPort: port, controlUrl: m.controlUrl, serviceType: m.serviceType }); } catch {} return; }
    if (m.externalIp) {
      r.external = m.externalIp + (port === 25565 ? '' : ':' + port);
      r.upnp = { publicPort: port, controlUrl: m.controlUrl, serviceType: m.serviceType };
      slog(id, `Acesso de fora: ${r.external} (UPnP ✓)`);
    } else {
      slog(id, 'UPnP respondeu mas sem IP externo.');
    }
  } catch (e) {
    slog(id, `UPnP indisponível (${e.message}). Na mesma rede use o IP local; de fora, libere a porta no roteador ou use tunnel (playit.gg).`);
  }
  try { win?.webContents.send('server-state', { id, running: runningServers.has(id) }); } catch {}
}
ipcMain.handle('server-add', (_, data) => {
  const list = loadServers();
  const s = {
    id: 'srv-' + Date.now().toString(36),
    name: String(data?.name || 'Servidor').slice(0, 40),
    type: ['minecraft-java', 'hytale-steamcmd', 'custom'].includes(data?.type) ? data.type : 'minecraft-java',
    version: String(data?.version || '26.3'),
    ram: String(data?.ram || '2G'),
    port: +(data?.port || 25565),
    appId: String(data?.appId || ''),
    exe: String(data?.exe || ''),
    args: String(data?.args || ''),
    address: String(data?.address || '').slice(0, 120),
    createdAt: Date.now()
  };
  list.push(s); saveServers(list);
  return s;
});
ipcMain.handle('server-delete', (_, id) => {
  const r = runningServers.get(id);
  if (r) throw new Error('Pare o servidor antes de excluir.');
  saveServers(loadServers().filter(s => s.id !== id));
  return true;
});
ipcMain.handle('server-set-address', (_, id, address) => {
  // Endereço personalizado p/ entrar (IP público, domínio ou tunnel). Só rótulo: não muda porta/rede.
  const list = loadServers();
  const s = list.find(x => x.id === id);
  if (!s) throw new Error('Servidor não encontrado.');
  s.address = String(address || '').slice(0, 120);
  saveServers(list);
  return true;
});

// ---------- Tunnel playit.gg ----------
playit.setEventHandler((type) => {
  if (type === 'state') { try { win?.webContents.send('playit-state', playit.status()); } catch {} }
});
ipcMain.handle('playit-status', () => ({ ...playit.status(), hasSecret: !!getSettings().playitSecret }));
ipcMain.handle('playit-start', async () => {
  await playit.start(userData(), getSettings().playitSecret, downloadFile);
  try { win?.webContents.send('playit-state', playit.status()); } catch {}
  return playit.status();
});
ipcMain.handle('playit-stop', () => playit.stop());
ipcMain.handle('open-external', (_, url) => {
  // Links externos só p/ domínios conhecidos (anti-phishing)
  const u = String(url || '');
  if (!/^https:\/\/(www\.)?playit\.gg(\/|$)/.test(u) && !/^https:\/\/github\.com\/nathanijanques2012-sys\//.test(u)) throw new Error('Link bloqueado.');
  shell.openExternal(u);
  return true;
});
ipcMain.handle('server-log-get', (_, id) => (runningServers.get(id)?.log || []).join('\n'));

async function ensureSteamCmd() {
  const dir = path.join(userData(), 'tools', 'steamcmd');
  const exe = path.join(dir, 'steamcmd.exe');
  if (!fs.existsSync(exe)) {
    const zip = path.join(userData(), '.cache', 'steamcmd.zip');
    await downloadFile('https://media.steampowered.com/installer/steamcmd.zip', zip, 'SteamCMD');
    fs.mkdirSync(dir, { recursive: true });
    execFileSync('powershell.exe', ['-NoProfile', '-Command', `Expand-Archive -Path '${zip}' -DestinationPath '${dir}' -Force`], { stdio: 'ignore', timeout: 120000 });
    fs.rmSync(zip, { force: true });
  }
  return exe;
}

async function ensureMcServer(s) {
  const dir = serverDir(s);
  fs.mkdirSync(dir, { recursive: true });
  const jar = path.join(dir, 'server.jar');
  const marker = path.join(dir, '.version');
  const need = !fs.existsSync(jar) || (fs.existsSync(marker) ? fs.readFileSync(marker, 'utf8') !== s.version : true);
  if (need) {
    slog(s.id, `Baixando servidor Minecraft ${s.version}...`);
    const m = await (await fetchT('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json')).json();
    const v = (m.versions || []).find(x => x.id === s.version && x.type === 'release');
    if (!v) throw new Error('Versão inválida: ' + s.version);
    const j = await (await fetchT(v.url)).json();
    const url = j.downloads?.server?.url;
    if (!url) throw new Error('Sem server.jar p/ ' + s.version + ' (versão muito antiga?).');
    await downloadFile(url, jar, `Servidor ${s.version}`);
    fs.writeFileSync(marker, s.version);
  }
  const eula = path.join(dir, 'eula.txt');
  if (!fs.existsSync(eula)) fs.writeFileSync(eula, '# Auto-aceito pelo Obsidian Launcher\neula=true\n');
  const props = path.join(dir, 'server.properties');
  if (!fs.existsSync(props)) fs.writeFileSync(props, `server-port=${s.port}\nmax-players=20\nonline-mode=false\nmotd=Obsidian Server - ${s.name}\n`);
  return jar;
}

ipcMain.handle('server-start', async (_, id) => {
  if (runningServers.has(id)) return { already: true };
  const s = loadServers().find(x => x.id === id);
  if (!s) throw new Error('Servidor não encontrado.');
  const { spawn } = require('child_process');
  let cmd, args, cwd;
  if (s.type === 'minecraft-java') {
    const jar = await ensureMcServer(s);
    const java = await ensureJava(await getRequiredJava(s.version));
    cmd = java; args = [`-Xmx${s.ram}`, '-jar', jar, 'nogui']; cwd = serverDir(s);
  } else if (s.type === 'hytale-steamcmd') {
    if (!s.appId) throw new Error('Falta o App ID do servidor Hytale (edite o servidor).');
    const steam = await ensureSteamCmd();
    const dir = serverDir(s);
    fs.mkdirSync(dir, { recursive: true });
    slog(id, 'Atualizando servidor Hytale via SteamCMD...');
    execFileSync(steam, ['+force_install_dir', dir, '+login', 'anonymous', '+app_update', s.appId, 'validate', '+quit'], { stdio: 'ignore', timeout: 1800000 });
    const exe = s.exe ? path.join(dir, s.exe) : fs.readdirSync(dir, { recursive: true }).find(f => /hytale.*server.*\.exe$/i);
    if (!exe || !fs.existsSync(path.join(dir, exe))) throw new Error('Executável do servidor não achado. Ajuste o campo exe.');
    cmd = path.join(dir, exe); args = (s.args || '').split(' ').filter(Boolean); cwd = dir;
  } else {
    if (!s.exe || !fs.existsSync(s.exe)) throw new Error('Executável inválido.');
    cmd = s.exe; args = (s.args || '').split(' ').filter(Boolean); cwd = path.dirname(s.exe);
  }
  slog(id, `Iniciando: ${cmd} ${args.join(' ')}`);
  const proc = spawn(cmd, args, { cwd, windowsHide: true });
  runningServers.set(id, { proc, log: [] });
  // UPnP em 2º plano: tenta abrir a porta no roteador sozinho (não trava o start)
  exposeUpnp(id, s).catch(() => {});
  proc.stdout.on('data', (d) => String(d).split('\n').forEach(l => l.trim() && slog(id, l)));
  proc.stderr.on('data', (d) => String(d).split('\n').forEach(l => l.trim() && slog(id, l)));
  proc.on('exit', (code) => { runningServers.delete(id); slog(id, `--- processo encerrou (código ${code}) ---`); win?.webContents.send('server-state', { id, running: false }); });
  proc.on('error', (e) => { runningServers.delete(id); slog(id, 'ERRO: ' + e.message); win?.webContents.send('server-state', { id, running: false }); });
  win?.webContents.send('server-state', { id, running: true });
  return { started: true };
});

ipcMain.handle('server-stop', (_, id) => {
  const r = runningServers.get(id);
  if (!r) return { stopped: false };
  if (r.upnp) {
    const u = r.upnp; r.upnp = null;
    upnp.unmapPort(u).then(() => slog(id, 'UPnP: porta fechada ✓')).catch((e) => slog(id, 'UPnP: ' + e.message));
  }
  try { r.proc.stdin.write('stop\n'); } catch {}
  setTimeout(() => { try { r.proc.kill('SIGKILL'); } catch {} }, 8000).unref?.();
  return { stopping: true };
});
ipcMain.handle('server-cmd', (_, id, cmd) => {
  const r = runningServers.get(id);
  if (!r) throw new Error('Servidor parado.');
  r.proc.stdin.write(String(cmd).slice(0, 500) + '\n');
  return true;
});

ipcMain.handle('repair-version', async () => {
  // Apaga versão/natives p/ baixar tudo do zero (cura arquivos corrompidos)
  const s = getSettings();
  const log = (m) => win?.webContents.send('launch-log', m);
  let n = 0;
  try {
    const vdir = path.join(s.gameDir, 'versions');
    if (fs.existsSync(vdir)) {
      for (const d of fs.readdirSync(vdir)) {
        if (d === s.version || d.includes(s.version)) {
          fs.rmSync(path.join(vdir, d), { recursive: true, force: true });
          n++;
        }
      }
    }
  } catch {}
  try {
    for (const d of fs.readdirSync(os.tmpdir())) {
      if (/^lwjgl_/.test(d)) fs.rmSync(path.join(os.tmpdir(), d), { recursive: true, force: true });
    }
  } catch {}
  log(`Reparo: ${n} pasta(s) de versão removidas. Clique JOGAR p/ baixar tudo de novo ✓`);
  return { removed: n };
});

// ---------- Amigos (só Obsidian: lista local + status real via ping) ----------
function friendsPath() { return path.join(userData(), 'friends.json'); }
function loadFriends() { try { const a = JSON.parse(fs.readFileSync(friendsPath(), 'utf8')); return Array.isArray(a) ? a : []; } catch { return []; } }
function saveFriends(f) { fs.mkdirSync(path.dirname(friendsPath()), { recursive: true }); fs.writeFileSync(friendsPath(), JSON.stringify(f, null, 2)); }

function writeVarInt(buf, v, off) {
  let i = off || 0;
  const out = buf || [];
  const push = buf ? (x) => { out[i++] = x; } : (x) => out.push(x);
  do { let b = v & 0x7F; v >>>= 7; if (v) b |= 0x80; push(b); } while (v);
  return buf ? i : Buffer.from(out);
}
function readVarInt(buf, off) {
  let v = 0, shift = 0, i = off || 0, b;
  do { b = buf[i++]; v |= (b & 0x7F) << shift; shift += 7; } while (b & 0x80);
  return { value: v, next: i };
}
function mcPacket(id, data) {
  const body = Buffer.concat([writeVarInt(null, id), data || Buffer.alloc(0)]);
  return Buffer.concat([writeVarInt(null, body.length), body]);
}
function mcString(s) {
  const b = Buffer.from(s, 'utf8');
  return Buffer.concat([writeVarInt(null, b.length), b]);
}

function pingServer(address, timeoutMs = 6000) {
  // ServerListPing: handshake + status. Retorna {online, ms, version, players, motd}
  return new Promise((resolve) => {
    const done = (r) => { try { sock.destroy(); } catch {} resolve(r); };
    const timer = setTimeout(() => done({ online: false, error: 'timeout' }), timeoutMs);
    let host = address, port = 25565;
    const m = String(address).match(/^(.*?)(?::(\d+))?$/);
    if (m) { host = m[1]; if (m[2]) port = +m[2]; }
    const t0 = Date.now();
    const net = require('net');
    const sock = net.connect(port, host);
    let buf = Buffer.alloc(0), stage = 0;
    sock.on('connect', () => {
      const portBuf = Buffer.alloc(2); portBuf.writeUInt16BE(port);
      sock.write(mcPacket(0, Buffer.concat([writeVarInt(null, 767), mcString(host), portBuf, writeVarInt(null, 1)])));
      sock.write(mcPacket(0));
      stage = 1;
    });
    sock.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      try {
        const l = readVarInt(buf, 0);
        if (buf.length < l.next + l.value) return; // pacote incompleto
        const id = readVarInt(buf, l.next);
        const sl = readVarInt(buf, id.next);
        const json = JSON.parse(buf.slice(sl.next, sl.next + sl.value).toString('utf8'));
        clearTimeout(timer);
        const desc = typeof json.description === 'string' ? json.description : (json.description && (json.description.text || '')) || '';
        done({ online: true, ms: Date.now() - t0, version: (json.version && json.version.name) || '?', players: json.players ? `${json.players.online}/${json.players.max}` : '?', motd: String(desc).replace(/§./g, '').slice(0, 80) });
      } catch {}
    });
    sock.on('error', () => { clearTimeout(timer); done({ online: false, error: 'recusado' }); });
    sock.on('timeout', () => done({ online: false, error: 'timeout' }));
  });
}

ipcMain.handle('friends-list', () => loadFriends());
ipcMain.handle('friend-add', (_, nick, address) => {
  nick = String(nick || '').trim().slice(0, 24);
  address = String(address || '').trim().replace(/\s/g, '');
  if (!nick) throw new Error('Dê um nick.');
  if (!/^[\w.\-:]+$/.test(address)) throw new Error('Endereço inválido (ex: jogar.meuservidor.com:25565).');
  const f = loadFriends().filter(x => x.nick.toLowerCase() !== nick.toLowerCase());
  f.push({ nick, address, addedAt: Date.now() });
  saveFriends(f);
  return true;
});
ipcMain.handle('friend-delete', (_, nick) => {
  saveFriends(loadFriends().filter(x => x.nick !== nick));
  return true;
});
ipcMain.handle('friend-ping', (_, address) => pingServer(address));
ipcMain.handle('invite-create', (_, address) => {
  const mc = getSettings().version;
  const code = 'OBS1-' + Buffer.from(JSON.stringify({ a: String(address).trim(), v: mc }), 'utf8').toString('base64url');
  return { code, mc };
});
ipcMain.handle('invite-accept', (_, code, nick) => {
  const m = String(code || '').trim().match(/^OBS1-([A-Za-z0-9_-]+)$/);
  if (!m) throw new Error('Código inválido (formato OBS1-...).');
  const { a, v } = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'));
  if (!a) throw new Error('Convite vazio.');
  nick = String(nick || '').trim().slice(0, 24) || String(a).split(/[:.]/)[0];
  const f = loadFriends().filter(x => x.nick.toLowerCase() !== nick.toLowerCase());
  f.push({ nick, address: a, mc: v, addedAt: Date.now() });
  saveFriends(f);
  return { nick, address: a, mc: v };
});

// ---------- Skins ----------
function getSkinsDir() {
  const d = path.join(userData(), 'skins');
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function pngDims(p) {
  const b = Buffer.alloc(32);
  const fd = fs.openSync(p, 'r');
  try { fs.readSync(fd, b, 0, 32, 0); } finally { fs.closeSync(fd); }
  if (b.readUInt32BE(12) !== 0x49484452) throw new Error('PNG inválido');
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
ipcMain.handle('skin-list', () => {
  const presetDir = path.join(__dirname, 'assets', 'skins');
  const out = [];
  if (fs.existsSync(presetDir)) {
    for (const f of fs.readdirSync(presetDir).filter(f => f.endsWith('.png'))) {
      out.push({ name: f.replace(/\.png$/, ''), file: f, preset: true, url: 'data:image/png;base64,' + fs.readFileSync(path.join(presetDir, f)).toString('base64') });
    }
  }
  for (const f of fs.readdirSync(getSkinsDir()).filter(f => f.endsWith('.png'))) {
    out.push({ name: f.replace(/\.png$/, ''), file: f, preset: false, url: 'data:image/png;base64,' + fs.readFileSync(path.join(getSkinsDir(), f)).toString('base64') });
  }
  const sel = getSettings().selectedSkin || null;
  return { skins: out, selected: sel };
});
ipcMain.handle('skin-import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, { title: 'Importar skin (PNG 64x64)', filters: [{ name: 'Skin', extensions: ['png'] }], properties: ['openFile'] });
  if (canceled || !filePaths[0]) return null;
  const { w, h } = pngDims(filePaths[0]);
  if (!((w === 64 && h === 64) || (w === 64 && h === 32))) throw new Error(`Skin deve ser 64x64 ou 64x32 (achado ${w}x${h})`);
  const safe = path.basename(filePaths[0]).replace(/[^A-Za-z0-9_.-]/g, '_');
  const dest = path.join(getSkinsDir(), safe);
  fs.copyFileSync(filePaths[0], dest);
  return { file: safe };
});
ipcMain.handle('skin-delete', (_, file) => {
  const p = path.join(getSkinsDir(), path.basename(file));
  if (fs.existsSync(p)) fs.unlinkSync(p);
  const s = getSettings();
  if (s.selectedSkin === path.basename(file)) saveJson(settingsPath(), { ...s, selectedSkin: null });
  return true;
});
ipcMain.handle('skin-apply', async (_, file, variant = 'classic') => {
  variant = variant === 'slim' ? 'slim' : 'classic';
  const accounts = loadJson(accountsPath(), []);
  const acc = accounts[0];
  if (!acc) throw new Error('Faça login primeiro.');
  // Localiza o arquivo (importado ou preset)
  const base = path.basename(file);
  let src = path.join(getSkinsDir(), base);
  if (!fs.existsSync(src)) src = path.join(__dirname, 'assets', 'skins', base);
  if (!fs.existsSync(src)) throw new Error('Skin não encontrada.');
  saveJson(settingsPath(), { ...getSettings(), selectedSkin: base, skinVariant: variant });
  if (acc.type === 'offline') {
    // StraySkins: aplica skin offline dentro do jogo (loader Fabric)
    if (getSettings().loader !== 'fabric') throw new Error('Skin offline precisa do loader Fabric. Troque no Jogar e aplique de novo.');
    await ensureStraySkins(getSettings().gameDir, getSettings().version);
    const dir = path.join(getSettings().gameDir, 'strayskins', 'skin');
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(src, path.join(dir, acc.profile.name + '.png'));
    return { offline: true, msg: `Skin aplicada p/ ${acc.profile.name} ✓ Carrega sozinha ao entrar no mundo.` };
  }
  const token = acc.mclc && (acc.mclc.access_token || acc.mclc.accessToken);
  if (!token) throw new Error('Token inválido, faça login Microsoft de novo.');
  const form = new FormData();
  form.append('variant', variant === 'slim' ? 'slim' : 'classic');
  form.append('file', new Blob([fs.readFileSync(src)], { type: 'image/png' }), base);
  const r = await fetch('https://api.minecraftservices.com/minecraft/profile/skins', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form
  });
  if (r.status === 401) throw new Error('Sessão expirada, faça login Microsoft de novo.');
  if (!r.ok) throw new Error('Mojang recusou a skin (' + r.status + '). Use PNG 64x64.');
  return { offline: false, msg: `Skin "${base}" aplicada na conta ${acc.profile?.name} ✓ (pode demorar p/ atualizar no jogo)` };
});

async function ensureStraySkins(root, mcVersion) {
  // StraySkins: skins offline no Fabric (pasta strayskins/skin/Nick.png)
  const log = (m) => win?.webContents.send('launch-log', m);
  const mods = path.join(root, 'mods');
  fs.mkdirSync(mods, { recursive: true });
  for (const f of fs.readdirSync(mods)) {
    // Remove build velha p/ outro MC (ex: 1.21.1 no jogo 1.21 crasha o Fabric)
    if (/^strayskins-.*\.jar$/.test(f) && !fabricMcOk(path.join(mods, f), mcVersion)) {
      fs.unlinkSync(path.join(mods, f));
      log('StraySkins incompatível removido, baixando certo...');
    }
  }
  for (const f of fs.readdirSync(mods)) {
    if (/^strayskins-.*\.jar$/.test(f)) { log('StraySkins ok ✓'); return path.join(mods, f); }
  }
  const url = `https://api.modrinth.com/v2/project/OFY20RfV/version?loaders=${JSON.stringify(['fabric'])}&game_versions=${JSON.stringify([mcVersion])}&limit=3`;
  const r = await fetch(url, { headers: { 'User-Agent': 'ObsidianLauncher/0.2' } });
  if (!r.ok) { log('Aviso: StraySkins não tem build p/ ' + mcVersion); return null; }
  const versions = await r.json();
  const ver = (versions || []).find(v => (v.files || []).some(f => f.primary)) || versions[0];
  if (!ver) return null;
  const file = (ver.files || []).find(f => f.primary) || ver.files[0];
  log(`Baixando StraySkins ${ver.version_number}...`);
  const dl = await fetch(file.url);
  if (!dl.ok) throw new Error('Download StraySkins falhou: ' + dl.status);
  const dest = path.join(mods, file.filename);
  fs.writeFileSync(dest, Buffer.from(await dl.arrayBuffer()));
  log('StraySkins instalado ✓');
  return dest;
}

app.whenReady().then(() => { createWindow(); setupAutoUpdate(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
