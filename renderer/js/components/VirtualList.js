/**
 * VirtualList Component - Renderiza apenas itens visíveis
 * Para listas grandes (100+ mods, shaders, amigos) mantém 60fps
 */

export class VirtualList {
  /**
   * @param {Object} options
   * @param {HTMLElement} options.container - Elemento pai (deve ter altura fixa/overflow)
   * @param {Array} options.items - Array de dados
   * @param {Function} options.renderItem - (item, index) => HTML string ou HTMLElement
   * @param {number} [options.itemHeight=80] - Altura estimada de cada item (px)
   * @param {number} [options.buffer=5] - Itens extras acima/abaixo da viewport
   * @param {Function} [options.onScroll] - Callback ao scroll
   * @param {string} [options.emptyMessage='Nenhum item'] - Mensagem quando vazio
   */
  constructor({ container, items = [], renderItem, itemHeight = 80, buffer = 5, onScroll, emptyMessage = 'Nenhum item' }) {
    this.container = container;
    this.items = items;
    this.renderItem = renderItem;
    this.itemHeight = itemHeight;
    this.buffer = buffer;
    this.onScroll = onScroll;
    this.emptyMessage = emptyMessage;
    
    this.scrollTop = 0;
    this.containerHeight = 0;
    this.visibleStart = 0;
    this.visibleEnd = 0;
    
    this._initContainer();
    this._bindEvents();
    this._calculateVisibleRange();
    this._renderVisible();
  }
  
  _initContainer() {
    // Container precisa ter position relative/absolute e overflow auto
    const style = getComputedStyle(this.container);
    if (style.position === 'static') {
      this.container.style.position = 'relative';
    }
    this.container.style.overflowY = 'auto';
    this.container.style.overflowX = 'hidden';
    
    // Cria elementos internos
    this.container.innerHTML = `
      <div class="vl-spacer" style="height: 0;"></div>
      <div class="vl-content" style="position: absolute; top: 0; left: 0; right: 0; will-change: transform;"></div>
      <div class="vl-spacer" style="height: 0;"></div>
    `;
    
    this.topSpacer = this.container.querySelector('.vl-spacer:first-child');
    this.content = this.container.querySelector('.vl-content');
    this.bottomSpacer = this.container.querySelector('.vl-spacer:last-child');
    
    // Empty state
    this.emptyEl = document.createElement('div');
    this.emptyEl.className = 'vl-empty';
    this.emptyEl.style.cssText = `
      display: none; padding: 32px; text-align: center; color: var(--muted, #a795cc);
      font-size: 14px; width: 100%; box-sizing: border-box;
    `;
    this.emptyEl.textContent = this.emptyMessage;
    this.content.appendChild(this.emptyEl);
  }
  
  _bindEvents() {
    // Scroll com requestAnimationFrame para performance
    let rafId = null;
    this.container.addEventListener('scroll', () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        this.scrollTop = this.container.scrollTop;
        this._calculateVisibleRange();
        this._renderVisible();
        if (this.onScroll) this.onScroll(this.scrollTop);
        rafId = null;
      });
    }, { passive: true });
    
    // Resize observer para altura do container
    this.resizeObserver = new ResizeObserver(() => {
      this.containerHeight = this.container.clientHeight;
      this._calculateVisibleRange();
      this._renderVisible();
    });
    this.resizeObserver.observe(this.container);
  }
  
  _calculateVisibleRange() {
    const start = Math.max(0, Math.floor(this.scrollTop / this.itemHeight) - this.buffer);
    const visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
    const end = Math.min(this.items.length, start + visibleCount + this.buffer * 2);
    
    this.visibleStart = start;
    this.visibleEnd = end;
  }
  
  _renderVisible() {
    const { visibleStart, visibleEnd, items, renderItem, itemHeight, topSpacer, bottomSpacer, content, emptyEl } = this;

    // Altura mínima: com poucos itens os spacers zeram e o conteúdo absoluto
    // não sustenta altura — container colapsaria e a lista sumiria.
    this.container.style.minHeight = items.length ? (Math.min(items.length, 3) * itemHeight + 'px') : '';
    
    if (items.length === 0) {
      topSpacer.style.height = '0';
      bottomSpacer.style.height = '0';
      content.style.transform = 'translateY(0)';
      emptyEl.style.display = 'block';
      return;
    }
    
    emptyEl.style.display = 'none';
    
    // Altura dos spacers
    const topHeight = visibleStart * itemHeight;
    const bottomHeight = Math.max(0, (items.length - visibleEnd) * itemHeight);
    
    topSpacer.style.height = `${topHeight}px`;
    bottomSpacer.style.height = `${bottomHeight}px`;
    
    // Renderiza itens visíveis
    const fragment = document.createDocumentFragment();
    for (let i = visibleStart; i < visibleEnd; i++) {
      const item = items[i];
      const html = renderItem(item, i);
      const div = document.createElement('div');
      div.style.height = `${itemHeight}px`;
      div.style.boxSizing = 'border-box';
      if (typeof html === 'string') {
        div.innerHTML = html;
      } else if (html instanceof Node) {
        div.appendChild(html);
      }
      fragment.appendChild(div);
    }
    
    // Preserva elementos que não são itens (empty state)
    const preserved = content.querySelector('.vl-empty');
    content.innerHTML = '';
    content.appendChild(fragment);
    if (preserved) content.appendChild(preserved);
  }
  
  /**
   * Atualiza items e re-renderiza
   */
  setItems(items) {
    this.items = items || [];
    this._calculateVisibleRange();
    this._renderVisible();
  }
  
  /**
   * Adiciona item no final
   */
  push(item) {
    this.items.push(item);
    this._calculateVisibleRange();
    this._renderVisible();
  }
  
  /**
   * Remove item por índice
   */
  removeAt(index) {
    this.items.splice(index, 1);
    this._calculateVisibleRange();
    this._renderVisible();
  }
  
  /**
   * Atualiza item específico
   */
  updateAt(index, newItem) {
    this.items[index] = newItem;
    if (index >= this.visibleStart && index < this.visibleEnd) {
      this._renderVisible();
    }
  }
  
  /**
   * Scroll para item específico
   */
  scrollToIndex(index) {
    this.container.scrollTop = index * this.itemHeight;
  }
  
  /**
   * Destrói o componente
   */
  destroy() {
    this.resizeObserver?.disconnect();
    this.container.innerHTML = '';
  }
}

/**
 * Factory function para uso mais simples
 */
export function createVirtualList(container, options) {
  return new VirtualList({ container, ...options });
}

export default VirtualList;