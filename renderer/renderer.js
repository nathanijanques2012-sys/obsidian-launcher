const $ = (id) => document.getElementById(id);

// Navegação
document.querySelectorAll('.nav').forEach(b => b.onclick = () => {
  document.querySelectorAll('.nav').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  $('page-' + b.dataset.page).classList.add('active');
});

function setUser(acc) {
  $('user').textContent = acc ? `${acc.name} (${acc.type})` : 'Não logado';
}

async function init() {
  const s = await window.api.getSettings();
  $('ramMin').value = s.ramMin; $('ramMax').value = s.ramMax;
  $('javaPath').value = s.javaPath || '';
  $('gameDir').value = s.gameDir || '';
  $('w').value = s.resolution.width; $('h').value = s.resolution.height;
  $('loader').value = s.loader;
  $('autoUpdate').checked = s.autoUpdate !== false;
  $('overlay').checked = s.overlay !== false;
  $('displayMode').value = s.displayMode || 'window';
  const versions = await window.api.getVersions().catch(() => ['1.21', '1.20.4', '1.19.4']);
  $('version').innerHTML = versions.map(v => `<option ${v === s.version ? 'selected' : ''}>${v}</option>`).join('');
  try { setUser(await window.api.getAccount()); } catch {}
  try { await refreshInstalled(); } catch {}
  try { await refreshContent('shader'); await refreshContent('resourcepack'); await refreshContent('modpack'); } catch {}
  try { await refreshSkins(); } catch {}
  paintCtx();
}
$('btnSave').onclick = async () => {
  $('saveMsg').textContent = 'Salvando...';
  await window.api.saveSettings({
    ramMin: $('ramMin').value, ramMax: $('ramMax').value,
    javaPath: $('javaPath').value, gameDir: $('gameDir').value || undefined,
    resolution: { width: +$('w').value, height: +$('h').value },
    version: $('version').value, loader: $('loader').value,
    autoUpdate: $('autoUpdate').checked, overlay: $('overlay').checked, fullscreen: false, displayMode: $('displayMode').value, softwareGL: false
  });
  $('progress').textContent = 'Config salva ✓';
  $('saveMsg').textContent = '✓ Config salva!';
  clearTimeout(window._saveT);
  window._saveT = setTimeout(() => { $('saveMsg').textContent = ''; }, 3000);
};
$('btnLogin').onclick = async () => {
  try { setUser(await window.api.login()); }
  catch (e) { alert('Login falhou: ' + e.message); }
};
$('btnOffline').onclick = async () => {
  try { setUser(await window.api.offlineLogin($('offlineName').value)); }
  catch (e) { alert('Offline falhou: ' + e.message); }
};
$('btnLogout').onclick = async () => { await window.api.logout(); setUser(null); };
function setPlaying(on) {
  $('btnPlay').style.display = on ? 'none' : '';
  $('btnStop').style.display = on ? '' : 'none';
  $('barFill').style.width = on ? '100%' : '5%';
}
$('btnPlay').onclick = async () => {
  $('log').textContent += 'Iniciando...\n';
  $('barFill').style.width = '5%';
  try { await window.api.launch({ version: $('version').value, loader: $('loader').value }); setPlaying(true); }
  catch (e) { $('log').textContent += 'ERRO: ' + e.message + '\n'; setPlaying(false); }
};
$('btnStop').onclick = async () => {
  $('btnStop').disabled = true;
  try { await window.api.stopGame(); } catch (e) { $('log').textContent += 'ERRO: ' + e.message + '\n'; }
  setPlaying(false);
  $('btnStop').disabled = false;
};
window.api.onGameStarted(() => setPlaying(true));
window.api.onGameClosed(() => setPlaying(false));
function ctxLabel() { return `${$('loader').value} • ${$('version').value}`; }
function paintCtx() { for (const id of ['modsCtx', 'shadersCtx', 'packsCtx', 'modpacksCtx']) { const el = $(id); if (el) el.textContent = ctxLabel(); } }
$('version').addEventListener?.('change', paintCtx);

function verChip(m) {
  const loaders = (m.categories || []).filter(c => ['fabric', 'forge', 'quilt', 'neoforge'].includes(c)).join('/');
  const supported = (m.versions || []).join(', ');
  const label = `${loaders ? loaders + ' • ' : ''}MC ${$('version').value}`;
  return `<span class="chip" title="Suporta: ${supported || '?'}">${label}</span>`;
}

async function runSearch(kind, queryId, boxId) {
  $(boxId).innerHTML = '<span class="muted">Buscando...</span>';
  try {
    const r = await window.api.searchModrinth($(queryId).value, $('loader').value, $('version').value, kind);
    paintCtx();
    $(boxId).innerHTML = (r.hits || []).map(m => `<div class="mod"><b>${m.title}</b> ${verChip(m)} <span class="muted">⬇ ${m.downloads || 0}</span><br><span class="muted">${(m.description || '').slice(0, 140)}</span><br><button data-pid="${m.project_id}" data-kind="${kind}" class="dlx primary">Baixar p/ ${$('version').value}</button></div>`).join('') || '<span class="muted">Nada encontrado</span>';
    $(boxId).querySelectorAll('.dlx').forEach(b => b.onclick = async () => {
      b.disabled = true; b.textContent = 'Baixando...';
      try {
        const res = kind === 'mod'
          ? await window.api.modDownload(b.dataset.pid, $('loader').value, $('version').value)
          : await window.api.contentDownload(kind, b.dataset.pid, $('loader').value, $('version').value);
        b.textContent = (res.skipped ? 'Já instalado ✓ ' : 'Instalado ✓ ') + (res.file || '');
        if (res.version) b.textContent += ` (v${res.version})`;
        refreshInstalled();
        refreshContent('shader'); refreshContent('resourcepack'); refreshContent('modpack');
      } catch (e) { b.textContent = 'Erro'; alert('Download falhou: ' + e.message); b.disabled = false; }
    });
  } catch (e) { $(boxId).innerHTML = 'Erro: ' + e.message; }
}

$('btnSearch').onclick = () => runSearch('mod', 'modQuery', 'mods');
$('btnShaderSearch').onclick = () => runSearch('shader', 'shaderQuery', 'shaders');
$('btnPackSearch').onclick = () => runSearch('resourcepack', 'packQuery', 'packs');
$('btnModpackSearch').onclick = () => runSearch('modpack', 'modpackQuery', 'modpacks');

async function refreshInstalled() {
  try {
    const list = await window.api.modsList();
    $('modsCount').textContent = list.length;
    $('modsInstalled').innerHTML = list.map(m => `<div class="mod"><b>${m.name}</b> <span class="muted">${(m.size / 1024).toFixed(0)} KB</span> <button data-del="${m.name}" class="ghost">Excluir</button></div>`).join('') || '<span class="muted">Nenhum mod. Troque para Fabric e baixe Sodium p/ testar.</span>';
    document.querySelectorAll('#modsInstalled [data-del]').forEach(b => b.onclick = async () => { await window.api.modDelete(b.dataset.del); refreshInstalled(); });
  } catch (e) { $('modsInstalled').textContent = 'Erro: ' + e.message; }
}

const CONTENT_UI = {
  shader: { list: 'shadersInstalled', count: 'shadersCount', empty: 'Nenhum shader. Ex: Bliss ou Complementary.' },
  resourcepack: { list: 'packsInstalled', count: 'packsCount', empty: 'Nenhum resource pack.' },
  modpack: { list: 'modpacksInstalled', count: 'modpacksCount', empty: 'Nenhum modpack baixado.' }
};
async function refreshContent(kind) {
  const ui = CONTENT_UI[kind];
  if (!ui || !$(ui.list)) return;
  try {
    const list = await window.api.contentList(kind);
    $(ui.count).textContent = list.length;
    $(ui.list).innerHTML = list.map(m => `<div class="mod"><b>${m.name}</b> <span class="muted">${(m.size / 1024 / 1024).toFixed(1)} MB</span> <button data-k="${kind}" data-del="${m.name}" class="ghost">Excluir</button></div>`).join('') || `<span class="muted">${ui.empty}</span>`;
    $(ui.list).querySelectorAll('[data-del]').forEach(b => b.onclick = async () => { await window.api.contentDelete(b.dataset.k, b.dataset.del); refreshContent(kind); });
  } catch (e) { $(ui.list).textContent = 'Erro: ' + e.message; }
}
$('btnModsRefresh').onclick = refreshInstalled;
$('btnModsFolder').onclick = () => window.api.openModsFolder();
$('btnShadersRefresh').onclick = () => refreshContent('shader');
$('btnShadersFolder').onclick = () => window.api.openContentFolder('shader');
$('btnPacksRefresh').onclick = () => refreshContent('resourcepack');
$('btnPacksFolder').onclick = () => window.api.openContentFolder('resourcepack');
$('btnModpacksRefresh').onclick = () => refreshContent('modpack');
$('btnModpacksFolder').onclick = () => window.api.openContentFolder('modpack');
$('btnOverlayInfo').onclick = () => alert('1) Selecione loader Fabric + versão 1.21\n2) Jogue 1x para criar pasta mods/\n3) Build do obsidian-mod/ (README lá) gera obsidian-overlay.jar\n4) Copie p/ mods/ ou clique Abrir pasta\n5) Jogue com Fabric. Aperte O no jogo p/ menu Obsidian (FPS/coords/CPS).');
$('btnGameDir').onclick = () => window.api.openGameDir();
$('btnCrash').onclick = async () => {
  const c = await window.api.lastCrash();
  $('log').textContent += `\n--- ${c.file || 'crash'} ---\n${c.head}\n`;
  $('log').scrollTop = 1e9;
};
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
    const R = (sx, sy, sw, sh, dx, dy, dw, dh) => { try { g.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh); } catch {} };
    R(8, 8, 8, 8, 16, 0, 32, 32);    // cabeca
    R(20, 20, 8, 12, 16, 32, 32, 48); // tronco
    R(44, 20, 4, 12, 0, 32, 16, 48);  // braco dir
    R(36, 52, 4, 12, 48, 32, 16, 48); // braco esq
    R(4, 20, 4, 12, 16, 80, 16, 48);  // perna dir
    R(20, 52, 4, 12, 32, 80, 16, 48); // perna esq
  };
  img.src = url;
}
async function refreshSkins() {
  const box = $('skins');
  if (!box) return;
  box.innerHTML = '<span class="muted">Carregando...</span>';
  try {
    const { skins, selected } = await window.api.skinList();
    box.innerHTML = skins.map(s => `<div class="skin-card${selected === s.file ? ' sel' : ''}"><canvas width="64" height="128"></canvas><b>${s.name}</b>${s.preset ? '<span class="muted">preset</span>' : ''}${selected === s.file ? '<span class="chip">em uso</span>' : ''}<div class="login-row"><button data-use="${s.file}" class="primary">Usar</button>${s.preset ? '' : `<button data-delskin="${s.file}" class="ghost">Excluir</button>`}</div></div>`).join('') || '<span class="muted">Sem skins.</span>';
    box.querySelectorAll('canvas').forEach((c, i) => drawSkinPreview(c, skins[i].url));
    box.querySelectorAll('[data-use]').forEach(b => b.onclick = async () => {
      b.disabled = true; $('skinMsg').textContent = 'Aplicando...';
      try { const r = await window.api.skinApply(b.dataset.use, $('skinVariant').value); $('skinMsg').textContent = r.msg; refreshSkins(); }
      catch (e) { $('skinMsg').textContent = 'Erro: ' + e.message; }
      b.disabled = false;
    });
    box.querySelectorAll('[data-delskin]').forEach(b => b.onclick = async () => { await window.api.skinDelete(b.dataset.delskin); refreshSkins(); });
  } catch (e) { box.innerHTML = 'Erro: ' + e.message; }
}
$('btnSkinImport').onclick = async () => {
  try { const r = await window.api.skinImport(); if (r) refreshSkins(); }
  catch (e) { $('skinMsg').textContent = 'Erro: ' + e.message; }
};
$('btnSkinsRefresh').onclick = refreshSkins;
$('btnUpdate').onclick = async () => { await window.api.checkUpdate(); };
window.api.onLog(v => { $('log').textContent += v + '\n'; $('log').scrollTop = 1e9; });
window.api.onProgress(v => {
  $('progress').textContent = v?.type ? `${v.type} ${v.task || ''} ${v.percentage || ''}` : JSON.stringify(v);
  if (typeof v?.percentage === 'number') $('barFill').style.width = Math.min(100, v.percentage) + '%';
});
window.api.onUpdateStatus(v => { $('updStatus').textContent = v; });
window.api.onUpdateReady(() => { $('btnRestart').style.display = 'block'; });
$('btnRestart').onclick = () => window.api.installUpdate();
init();
