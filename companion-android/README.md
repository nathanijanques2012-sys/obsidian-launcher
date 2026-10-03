# Obsidian Companion — App Android (WebView)

APK do app companheiro: abre o companion (amigos, mods, skins) em tela cheia.

> Não roda o jogo — para jogar no celular, o caminho é outro projeto
> (estilo Pojav: app nativo + JRE + conta oficial). Este APK é o controle remoto.

## Pré-requisitos (só na primeira vez)

- JDK 17+ (`JAVA_HOME` apontando p/ ele)
- Android SDK (`ANDROID_HOME`): `platform-tools`, `platforms;android-34`, `build-tools;34.0.0`
- Projeto **fora** de caminho com acento (ex: `C:\ObsidianAndroid`) — o AGP quebra com `ã`

## Build (debug)

```powershell
$env:JAVA_HOME="C:\jdk21"
$env:ANDROID_HOME="C:\Android\sdk"
C:\Android\gradle-8.10\bin\gradle.bat -p C:\ObsidianAndroid assembleDebug
# APK em: C:\ObsidianAndroid\app\build\outputs\apk\debug\app-debug.apk
```

`local.properties` (ignorado pelo git) aponta `sdk.dir` da máquina.

## Instalar no celular

1. No celular: Ativar **Opções do desenvolvedor** → **Depuração USB**
2. Conectar o USB, autorizar o PC
3. No PC:
```powershell
C:\Android\sdk\platform-tools\adb.exe devices   # tem que listar o aparelho
C:\Android\sdk\platform-tools\adb.exe install -r app-debug.apk
```

## Configurar o endereço

O app abre `http://192.168.1.103:8080/` (editar em
`app/src/main/java/com/obsidian/companion/MainActivity.java`, constante `HOME`).
Use o IP atual do PC; mesma rede Wi-Fi; relay em `ws://IP:8091`.
