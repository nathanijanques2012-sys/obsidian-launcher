# Obsidian Companion 📱

App companheiro do Obsidian Launcher: **chat de amigos, busca de mods e prévia de skins** no celular. Não roda o jogo (isso é projeto separado, estilo Pojav).

## Rodar local (teste)

```powershell
cd companion
npx serve .
# ou: python -m http.server 8080
```

Abra no celular o `http://IP-DO-PC:8080` (mesmo Wi-Fi).

## Instalar no celular (PWA)

1. Hospede a pasta em HTTPS (GitHub Pages, Netlify, Vercel — é só arquivo estático).
2. No Chrome do Android: menu ⋮ → **Instalar app** / **Adicionar à tela inicial**.
3. iPhone: Compartilhar → **Adicionar à Tela de Início** (push e algumas APIs limitadas no iOS, o resto funciona).

> PWA exige HTTPS em produção (`localhost` é exceção). Sem HTTPS o navegador bloqueia a instalação.

## Conectar nos amigos

Na aba Amigos, digite o endereço do relay: na mesma rede é `ws://IP-DO-PC:8091` (rode `node ../friend-server/server.js` no PC). Pela internet, o relay precisa de TLS (`wss://...`) via proxy reverso (nginx/Caddy) ou host com HTTPS.

## Launcher completo estilo Pojav?

Projeto à parte e gigante: app Android nativo (Kotlin + JNI), JRE portátil, tradução gráfica (Angle/Zink) e conta Microsoft oficial — mesma exigência de jogo original. O PojavLauncher é open-source (GPL) e é a referência. Se um dia seguir por aí, este companion vira o front.
