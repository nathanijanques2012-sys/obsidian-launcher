# Obsidian Launcher

Launcher de Minecraft Java Edition para Windows. Baixa o Java sozinho, instala Fabric/Forge/OptiFine e baixa o jogo — é só logar e jogar.

## Baixar e instalar (setup)

1. Baixe o instalador na página de releases: **https://github.com/nathanijanques2012-sys/obsidian-launcher/releases** — arquivo `Obsidian Launcher Setup vX.X.X.exe`
2. Rode o setup e instale
3. Abra o **Obsidian Launcher**, faça login com a **conta Microsoft dona do Minecraft Java**
4. Escolha versão + loader (ex: 1.21.1 + Forge), clique **JOGAR**

O launcher atualiza sozinho quando sair versão nova.

## Requisitos

- Windows 10/11 64-bit
- Conta Microsoft dona do Minecraft Java
- Driver de vídeo instalado (NVIDIA/AMD/Intel) — sem ele o jogo não abre (erro `0x10006`)

## Notas legais

Só funciona com jogo original. Login offline / pirata não incluído de propósito.

---

<details>
<summary>Para desenvolvedores (rodar do código-fonte)</summary>

Requisitos: Node 20+.

```powershell
npm.cmd install
npm.cmd start
```

Build do setup: `npm.cmd run dist` gera `dist/` com NSIS. O `electron-updater` publica/checa releases no GitHub (ver `package.json > build.publish`).
</details>
