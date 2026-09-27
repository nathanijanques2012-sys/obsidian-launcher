# Auto-update do Obsidian Launcher (todos os PCs)

Como funciona: o launcher instalado pelo **setup oficial** checa seu GitHub
a cada abertura (e a cada 6h). Se tiver release nova, baixa sozinho e mostra
o botão **Reiniciar e atualizar**.

## 1ª vez (só você faz, uma vez)

1. Crie conta em https://github.com e entre
2. Crie o repositório **`obsidian-launcher`** no usuário
   **`nathanijanques2012-sys`** (público; privado exige token nos clientes)
3. No PowerShell, DENTRO da pasta `MinecraftLauncher`:
```powershell
git init
git add .
git commit -m "Obsidian Launcher"
git branch -M main
git remote add origin https://github.com/nathanijanques2012-sys/obsidian-launcher.git
git push -u origin main
```
4. Confira em Actions se o workflow `Release` aparece (só roda com tag).

## Publicar uma atualização (toda alteração)

```powershell
cd "C:\Users\natha\Documents\Projeto Padrão\MinecraftLauncher"
npm version patch        # 0.2.0 -> 0.2.1 (use minor p/ novidade grande)
git add .
git commit -m "update"
git push
git push --tags          # <-- isso dispara o build do setup no GitHub
```

Em ~10min o setup novo está em Releases. Quem tem o launcher instalado
recebe sozinho ao abrir (ou no botão ↻).

## Amigo (cada PC, uma vez)

1. Baixa o `Obsidian-Launcher-Setup-X.Y.Z.exe` em
   https://github.com/nathanijanques2012-sys/obsidian-launcher/releases
2. Instala. Pronto — daqui pra frente atualiza sozinho.
3. Builds de pasta (`win-unpacked`) e seu setup NSIS local NÃO têm canal
   de update: servem p/ teste, não distribua esses.

## Regras

- SEMPRE suba a versão (`npm version patch/minor/major`): sem versão nova,
  os launchers acham que já estão atualizados.
- Não renomeie os arquivos do Releases (`latest.yml` + Setup + blockmap):
  o updater precisa deles.
- Repo privado: cada cliente precisaria de token — deixe público.
