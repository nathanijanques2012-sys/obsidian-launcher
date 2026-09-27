// Gera o setup dedicado: makensis (versão do package.json).
// Ícone via diretiva Icon + MUI_ICON (rcedit quebra o instalador NSIS).
// Uso: npm run setup  (faz pack + fix-exe + este script)
const { execFileSync } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..');
const { version } = require(path.join(root, 'package.json'));
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: 'inherit' });
run(path.join(root, 'tools', 'nsis', 'makensis.exe'), ['/DVERSION=' + version, path.join(root, 'tools', 'obsidian-setup.nsi')]);
console.log('setup ok:', path.join(root, 'dist', `Obsidian-Launcher-Setup-${version}.exe`));
