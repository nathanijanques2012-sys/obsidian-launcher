# Obsidian Overlay — mod Fabric in-game (estilo Labymod, versão simples)

HUD + menu próprio dentro do Minecraft. **Precisa jogar com loader Fabric.**

## Build
1. Instale JDK 21 (já tem em `../.jdk21`)
2. Rode:
```powershell
cd obsidian-mod
./gradlew build
```
3. Pegue `build/libs/obsidian-overlay-*.jar` e copie para a pasta `mods/` do jogo (botão Abrir pasta na aba Mods).
4. No launcher selecione loader Fabric + mesma versão (1.21) e clique JOGAR.
5. No jogo aperte **O** para abrir o menu Obsidian. HUD mostra FPS/coords sempre.

## O que tem
- `OverlayMod` — registra HUD + tecla O
- `OverlayHud` — overlay canto superior (logo, FPS, XYZ, CPS fake/contador de cliques)
- `OverlayScreen` — menu com toggles FPS / Coords / CPS

Labymod completo = meses de trabalho (cosméticos, voice, etc). Isso é a base para expandir.
