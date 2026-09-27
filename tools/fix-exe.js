// Aplica nome/icone no exe (contorna winCodeSign sem privilegio symlink)
const { execFileSync } = require('child_process');
const path = require('path');
const exe = path.join(__dirname, '..', 'dist', 'win-unpacked', 'Obsidian Launcher.exe');
const rcedit = path.join(__dirname, 'rcedit.exe');
const icon = path.join(__dirname, '..', 'assets', 'icon.ico');
execFileSync(rcedit, [exe, '--set-icon', icon,
  '--set-version-string', 'ProductName', 'Obsidian Launcher',
  '--set-version-string', 'FileDescription', 'Obsidian Launcher',
  '--set-version-string', 'CompanyName', 'Obsidian',
  '--set-version-string', 'LegalCopyright', 'Obsidian'], { stdio: 'inherit' });
console.log('fix-exe ok');
