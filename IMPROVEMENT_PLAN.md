# Obsidian Launcher - Plano de Melhorias (Performance/Qualidade → Visual/UX)

## Fase 1: Performance & Qualidade (Prioridade Alta)

### 1.1 Virtual Scrolling para Listas Grandes
- [ ] Implementar `VirtualList` component para `#mods`, `#shaders`, `#packs`, `#modpacks`, `#modsInstalled`, `#friends`
- Renderiza apenas itens visíveis + buffer (~5 itens)
- Elimina lag com 100+ mods instalados

### 1.2 Skeleton Loaders & Loading States
- [ ] Substituir "Buscando..." / "Carregando..." por skeleton cards
- [ ] Shimmer animation CSS-only
- [ ] Progress real da barra de download (já tem IPC `launch-progress`)

### 1.3 Debounced Search + Request Cache
- [ ] Debounce 300ms nos inputs de busca (`modQuery`, `shaderQuery`, etc)
- [ ] Cache em memória (Map) com TTL 5min para buscas Modrinth
- [ ] Cancelar request anterior se nova busca (AbortController)

### 1.4 Lazy Loading de Imagens/Skins
- [ ] `IntersectionObserver` para prévia de skins (canvas)
- [ ] Placeholder SVG até carregar
- [ ] Limitar cache de imagens em memória (LRU 40 itens)

### 1.5 Code Splitting / Lazy Modules
- [ ] Separar lógica por página em módulos ES6 dinâmicos (`import()`)
- [ ] Carregar módulo da página só ao clicar na nav
- [ ] Reduz bundle inicial ~40%

### 1.6 Error Boundaries & Toast Notifications
- [ ] Wrapper `try/catch` padronizado em todos handlers IPC
- [ ] Sistema de toast (sucesso, erro, aviso, info) não-bloqueante
- [ ] Log estruturado no console (dev) + arquivo (prod)

### 1.7 Accessibility (a11y)
- [ ] ARIA labels, roles, landmarks
- [ ] Navegação por teclado (Tab, Enter, Escape, setas)
- [ ] Focus management ao trocar páginas
- [ ] Contraste WCAG AA (já bom, verificar focus visible)
- [ ] `prefers-reduced-motion` para desativar animações

### 1.8 TypeScript Migration (Opcional mas recomendado)
- [ ] `tsconfig.json` + `jsconfig.json` para JSDoc types
- [ ] Types para IPC (`window.api`), settings, Modrinth API
- [ ] Catch bugs em compile-time

---

## Fase 2: Arquitetura CSS & Design System

### 2.1 Design Tokens (CSS Custom Properties)
- [ ] Extrair cores, spacing, radius, shadows, transitions para `:root`
- [ ] Semânticos: `--color-primary`, `--color-surface`, `--color-on-primary`
- [ ] Suporte a temas (dark/light/high-contrast) via `[data-theme]`

### 2.2 Component Library (CSS)
- [ ] `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-danger`
- [ ] `.input`, `.select`, `.checkbox`, `.radio`
- [ ] `.card`, `.card-header`, `.card-body`
- [ ] `.chip`, `.badge`, `.avatar`
- [ ] `.modal`, `.dialog`, `.toast`, `.tooltip`
- [ ] `.skeleton`, `.spinner`, `.progress`
- [ ] `.table`, `.list`, `.grid`

### 2.3 Utility Classes (Tailwind-style minimal)
- [ ] Spacing: `p-{1..8}`, `m-{1..8}`, `gap-{1..8}`
- [ ] Flex: `flex`, `flex-col`, `items-center`, `justify-between`, `gap-2`
- [ ] Grid: `grid`, `grid-cols-{1..4}`, `col-span-{1..4}`
- [ ] Sizing: `w-full`, `h-full`, `min-w-0`, `max-h-96`
- [ ] Typography: `text-sm`, `text-lg`, `font-medium`, `truncate`

### 2.4 Dark/Light/High-Contrast Themes
- [ ] Toggle no Config
- [ ] Persistir em `settings.json`
- [ ] `prefers-color-scheme` como default

---

## Fase 3: UX & Visual Polish

### 3.1 Dashboard / Home Page Rica
- [ ] Cards: "Continuar jogando", "Últimos mods", "Amigos online", "Atualizações"
- [ ] Stats: horas jogadas (localStorage), versões favoritas
- [ ] News/RSS do Minecraft/Modrinth (opcional)

### 3.2 Sidebar Colapsável + Responsive
- [ ] Botão ☰ para colapsar (só ícones)
- [ ] Breakpoint <900px: drawer mobile (slide-in)
- [ ] Persistir estado colapsado

### 3.3 Wizard First-Run
- [ ] Detecta se `settings.json` não existe
- [ ] Passos: Java, pasta do jogo, RAM, conta Microsoft/offline, tema
- [ ] Skipable

### 3.4 Perfis de Versão (Version Profiles)
- [ ] Salvar combos: "Fabric 1.21 + Sodium + Iris", "Forge 1.20.1 + OptiFine"
- [ ] Selector no hero ao lado de version/loader
- [ ] Clone, editar, deletar

### 3.5 Busca Global (Cmd/Ctrl+K)
- [ ] Modal: mods, shaders, packs, modpacks, amigos, configurações
- [ ] Fuzzy search local + Modrinth
- [ ] Atalhos de teclado visíveis

### 3.6 Notificações Toast System
- [ ] Substituir `alert()` por toasts
- [ ] Auto-dismiss 4s, action buttons (ex: "Ver log", "Retry")
- [ ] Queue (máx 3 simultâneos)

### 3.7 Micro-interactions & Motion
- [ ] Page transitions (fade + slide 150ms)
- [ ] Button press/tap feedback (scale 0.98)
- [ ] Hover states mais ricos (border glow, elevation)
- [ ] Staggered entrance para lists (CSS `animation-delay`)

### 3.8 Customização Visual
- [ ] Accent color picker (presets + custom HSL)
- [ ] Background: sólido, gradiente, imagem custom
- [ ] Import/export theme JSON

---

## Fase 4: Features Power-User

### 4.1 Multi-instance / Perfis Isolados
- [ ] Múltiplos `.minecraft` pastas
- [ ] Troca rápida no header

### 4.2 Modpack Creator (Export .mrpack)
- [ ] UI para selecionar mods/configs/overrides
- [ ] Gerar `modrinth.index.json` + zip

### 4.3 Log Viewer Avançado
- [ ] Aba dedicada com filtro, busca, highlight erros
- [ ] Export .txt, abrir latest.log

### 4.4 Server Browser (LAN + Favoritos)
- [ ] Scan LAN (UDP broadcast)
- [ ] Ping, players, version, MOTD
- [ ] Favoritos + join direto

---

## Métricas de Sucesso

| Métrica | Atual | Target |
|---------|-------|--------|
| Tempo inicial (cold start) | ~2.5s | <1.5s |
| Bundle JS (gzipped) | ~180KB | <100KB |
| Frame rate scrolling 100 mods | ~15fps | 60fps |
| Search keystroke → results | ~500ms | <200ms (cache) |
| Memory (idle) | ~120MB | <80MB |
| Lighthouse Accessibility | ~75 | >95 |
| Lighthouse Performance | ~60 | >90 |

---

## Ordem de Execução Sugerida

1. **Week 1**: Virtual scrolling + Skeleton + Debounce + Cache
2. **Week 2**: Toast system + Error handling + a11y + Code splitting
3. **Week 3**: Design tokens + Component CSS + Themes
4. **Week 4**: Dashboard + Sidebar collapsible + Wizard first-run
5. **Week 5**: Version profiles + Global search + Micro-interactions
6. **Week 6**: Polish, testes, documentação, release