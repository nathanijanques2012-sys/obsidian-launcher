/**
 * Skeleton Loaders - Placeholders animados enquanto carrega
 * Substitui "Buscando..." / "Carregando..." por UI perceptiva mais rápida
 */

// Estilos injetados uma vez
const skeletonStyles = `
  .skeleton {
    background: linear-gradient(90deg, 
      var(--panel2, #241544) 25%, 
      var(--panel, #1a1030) 50%, 
      var(--panel2, #241544) 75%
    );
    background-size: 200% 100%;
    animation: skeletonShimmer 1.5s ease-in-out infinite;
    border-radius: 8px;
    overflow: hidden;
  }
  @keyframes skeletonShimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  @media (prefers-reduced-motion: reduce) {
    .skeleton { animation: none; background: var(--panel2, #241544); }
  }
  .skeleton-text { height: 1em; margin: 0.5em 0; }
  .skeleton-text:last-child { width: 60%; }
  .skeleton-title { height: 1.5em; width: 40%; margin-bottom: 0.5em; }
  .skeleton-avatar { width: 48px; height: 48px; border-radius: 50%; }
  .skeleton-card { padding: 16px; }
  .skeleton-card-header { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
  .skeleton-card-body { display: flex; flex-direction: column; gap: 8px; }
  .skeleton-btn { height: 36px; width: 100px; border-radius: 8px; }
  .skeleton-chip { height: 20px; width: 80px; border-radius: 99px; }
  .skeleton-grid { display: grid; gap: 12px; }
  .skeleton-list { display: flex; flex-direction: column; gap: 10px; }
`;

/**
 * Injeta estilos se não existirem
 */
function ensureStyles() {
  if (!document.getElementById('skeleton-styles')) {
    const style = document.createElement('style');
    style.id = 'skeleton-styles';
    style.textContent = skeletonStyles;
    document.head.appendChild(style);
  }
}

/**
 * Cria skeleton de card de mod/shader/pack
 */
export function createModSkeleton() {
  ensureStyles();
  return `
    <div class="skeleton skeleton-card">
      <div class="skeleton-card-header">
        <div class="skeleton skeleton-avatar"></div>
        <div style="flex:1">
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-chip"></div>
        </div>
      </div>
      <div class="skeleton-card-body">
        <div class="skeleton skeleton-text" style="width: 80%;"></div>
        <div class="skeleton skeleton-text" style="width: 100%;"></div>
        <div class="skeleton skeleton-btn"></div>
      </div>
    </div>
  `;
}

/**
 * Cria skeleton de skin card
 */
export function createSkinSkeleton() {
  ensureStyles();
  return `
    <div class="skeleton skeleton-card" style="padding: 10px; text-align: center;">
      <div class="skeleton" style="width: 64px; height: 128px; margin: 0 auto 10px; border-radius: 8px;"></div>
      <div class="skeleton skeleton-text" style="width: 80px; margin: 0 auto;"></div>
      <div class="skeleton skeleton-btn" style="margin-top: 10px; width: 100%;"></div>
    </div>
  `;
}

/**
 * Cria skeleton de amigo
 */
export function createFriendSkeleton() {
  ensureStyles();
  return `
    <div class="skeleton skeleton-card">
      <div class="skeleton-card-header">
        <div class="skeleton skeleton-avatar" style="width: 40px; height: 40px;"></div>
        <div style="flex:1">
          <div class="skeleton skeleton-title" style="width: 100px;"></div>
          <div class="skeleton skeleton-text" style="width: 150px; height: 14px;"></div>
        </div>
        <div class="skeleton skeleton-chip"></div>
      </div>
      <div class="skeleton skeleton-btn" style="width: 100%; margin-top: 8px;"></div>
    </div>
  `;
}

/**
 * Cria skeleton genérico de lista
 * @param {number} count - Quantidade de itens
 * @param {Function} itemRenderer - Função que retorna HTML do skeleton item
 */
export function createListSkeleton(count, itemRenderer) {
  ensureStyles();
  return Array.from({ length: count }, (_, i) => itemRenderer(i)).join('');
}

/**
 * Cria skeleton de grid (para skins)
 */
export function createGridSkeleton(count, columns = 4) {
  ensureStyles();
  const items = Array.from({ length: count }, createSkinSkeleton).join('');
  return `<div class="skeleton-grid" style="grid-template-columns: repeat(${columns}, 1fr);">${items}</div>`;
}

/**
 * Cria skeleton de linha (para mods instalados, amigos)
 */
export function createListSkeletonLines(count) {
  ensureStyles();
  const items = Array.from({ length: count }, createModSkeleton).join('');
  return `<div class="skeleton-list">${items}</div>`;
}

/**
 * Mostra skeleton em um container
 * @param {HTMLElement} container 
 * @param {string} skeletonHtml 
 */
export function showSkeleton(container, skeletonHtml) {
  ensureStyles();
  container.innerHTML = skeletonHtml;
}

/**
 * Esconde skeleton e mostra conteúdo real
 * @param {HTMLElement} container 
 * @param {string|HTMLElement} content 
 */
export function hideSkeleton(container, content) {
  if (typeof content === 'string') {
    container.innerHTML = content;
  } else if (content instanceof Node) {
    container.innerHTML = '';
    container.appendChild(content);
  }
}

export default {
  createModSkeleton,
  createSkinSkeleton,
  createFriendSkeleton,
  createListSkeleton,
  createGridSkeleton,
  createListSkeletonLines,
  showSkeleton,
  hideSkeleton
};