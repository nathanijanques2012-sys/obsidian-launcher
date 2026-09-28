# Obsidian Friend Relay

Servidor de amizades do Obsidian Launcher: salas por código, quem tá online,
chat e "entrar no servidor do amigo".

## Rodar local (teste em casa)

```powershell
cd friend-server
node server.js        # porta 8091 (ou: node server.js 9000)
```

No launcher, aba Amigos → servidor `ws://127.0.0.1:8091`.
Na mesma Wi-Fi: use o IP do PC host, ex `ws://192.168.1.10:8091`
(descubra com `ipconfig`). Libere a porta no firewall se pedir.

## Rodar na internet (24/7)

Opções grátis: Render.com, Fly.io ou Oracle Cloud (sempre grátis).
O servidor é Node puro: `node server.js $PORT`. Depois aponte o campo
servidor no launcher p/ `ws://SEU-HOST:PORTA` (ou `wss://` com TLS).

## Protocolo

Relay (launcher ↔ servidor): mensagens JSON `{t, ...}` — veja o topo do
`server.js`. Porta padrão: **8091**.

Mod (jogo → launcher): o launcher espelha a sala em
`<gameDir>/obsidian/friends.json` (`{room, members[], at}`); o mod lê o
arquivo (Fabric `FriendFile.java`; Forge usa o mesmo contrato).
