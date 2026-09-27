# Vortex MC Launcher

Launcher Minecraft Java Edition em Electron.

## Requisitos
- Node 20+, Java 17/21 (para 1.20+ use Java 17+, para 1.21 use Java 21)
- Conta Microsoft dona do Minecraft Java
- Client ID Azure (MSMC usa OAuth Microsoft). Crie em https://portal.azure.com > Microsoft Entra > App registrations.
  Defina `MSMC_CLIENT_ID` ou edite `main.js`.

## Rodar
```powershell
npm.cmd install
npm.cmd start
```

## Build + auto-update
1. Crie repo GitHub e ajuste `package.json > build.publish` com owner/repo.
2. `npm.cmd run dist` gera `dist/` com NSIS.
3. Publique release no GitHub. `electron-updater` checa na inicialização.

## Notas legais
Só funciona com jogo original. Login offline / pirata não incluído de propósito.

## Roadmap
- [ ] Instalação real Fabric/Forge (hoje Fabric só seta custom version)
- [ ] Download de mods Modrinth para `mods/`
- [ ] Skins, perfis múltiplos, console completo
