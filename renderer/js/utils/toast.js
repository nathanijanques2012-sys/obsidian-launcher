/**
 * Toast Notification System
 * Substitui alert() por notificações não-bloqueantes com ações
 */

const TOAST_CONTAINER_ID = 'toast-container';
const MAX_TOASTS = 3;
let toastId = 0;

/**
 * Inicializa container de toasts
 */
function ensureContainer() {
  let container = document.getElementById(TOAST_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = TOAST_CONTAINER_ID;
    container.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
      max-width: 420px;
    `;
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Cria elemento toast
 */
function createToastElement({ type = 'info', title, message, duration = 4000, actions = [], persistent = false }) {
  const id = ++toastId;
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️',
    loading: '⏳'
  };
  
  const colors = {
    success: 'linear-gradient(135deg, #1a5c2e, #166534)',
    error: 'linear-gradient(135deg, #7f1d1d, #991b1b)',
    warning: 'linear-gradient(135deg, #78350f, #92400e)',
    info: 'linear-gradient(135deg, #1e3a5f, #1e40af)',
    loading: 'linear-gradient(135deg, #3b2270, #5b21b6)'
  };
  
  const el = document.createElement('div');
  el.dataset.toastId = id;
  el.style.cssText = `
    background: ${colors[type]};
    border: 1px solid rgba(255,255,255,0.15);
    border-radius: 12px;
    padding: 14px 16px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05);
    display: flex;
    gap: 12px;
    align-items: flex-start;
    animation: toastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    pointer-events: auto;
    backdrop-filter: blur(12px);
    min-width: 280px;
    max-width: 100%;
  `;
  
  // Estilos de animação (injetados uma vez)
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
      @keyframes toastIn {
        from { opacity: 0; transform: translateX(100px) scale(0.95); }
        to { opacity: 1; transform: translateX(0) scale(1); }
      }
      @keyframes toastOut {
        from { opacity: 1; transform: translateX(0) scale(1); }
        to { opacity: 0; transform: translateX(100px) scale(0.95); }
      }
      .toast-close { 
        background: none; border: none; color: rgba(255,255,255,0.7); 
        cursor: pointer; padding: 2px; line-height: 1; font-size: 18px;
        margin-left: auto; flex-shrink: 0;
      }
      .toast-close:hover { color: white; }
      .toast-action { 
        background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.2);
        color: white; padding: 6px 12px; border-radius: 8px; cursor: pointer;
        font-size: 12px; font-weight: 500; transition: background 0.15s;
      }
      .toast-action:hover { background: rgba(255,255,255,0.25); }
      .toast-actions { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
      .toast-title { font-weight: 600; font-size: 14px; margin-bottom: 2px; }
      .toast-message { font-size: 13px; opacity: 0.9; line-height: 1.4; }
      .toast-icon { font-size: 20px; flex-shrink: 0; margin-top: 1px; }
      .toast-content { flex: 1; min-width: 0; }
      @media (prefers-reduced-motion: reduce) {
        .toast-element { animation: none !important; }
      }
    `;
    document.head.appendChild(style);
  }
  
  el.className = 'toast-element';
  el.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${icons[type]}</span>
    <div class="toast-content">
      ${title ? `<div class="toast-title">${escapeHtml(title)}</div>` : ''}
      ${message ? `<div class="toast-message">${escapeHtml(message)}</div>` : ''}
      ${actions.length ? `
        <div class="toast-actions">
          ${actions.map(a => `<button class="toast-action" data-action="${escapeHtml(a.id)}">${escapeHtml(a.label)}</button>`).join('')}
        </div>
      ` : ''}
    </div>
    <button class="toast-close" aria-label="Fechar">✕</button>
  `;
  
  // Handlers
  el.querySelector('.toast-close').onclick = () => removeToast(id);
  
  if (actions.length) {
    el.querySelectorAll('.toast-action').forEach(btn => {
      btn.onclick = () => {
        const action = actions.find(a => a.id === btn.dataset.action);
        if (action?.handler) action.handler(toastApi);
        if (!action?.persist) removeToast(id);
      };
    });
  }
  
  // Auto-remove
  if (!persistent && duration > 0) {
    setTimeout(() => removeToast(id), duration);
  }
  
  return { id, element: el };
}

/**
 * Remove toast com animação
 */
function removeToast(id) {
  const el = document.querySelector(`[data-toast-id="${id}"]`);
  if (!el) return;
  el.style.animation = 'toastOut 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards';
  setTimeout(() => el.remove(), 250);
}

/**
 * Escape HTML para prevenir XSS
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

/**
 * API pública do toast
 */
const toastApi = {
  success: (title, message, options = {}) => showToast({ type: 'success', title, message, ...options }),
  error: (title, message, options = {}) => showToast({ type: 'error', title, message, ...options }),
  warning: (title, message, options = {}) => showToast({ type: 'warning', title, message, ...options }),
  info: (title, message, options = {}) => showToast({ type: 'info', title, message, ...options }),
  loading: (title, message, options = {}) => showToast({ type: 'loading', title, message, duration: 0, persistent: true, ...options }),
  
  // Remove todos
  clear: () => {
    const container = document.getElementById(TOAST_CONTAINER_ID);
    if (container) container.innerHTML = '';
  },
  
  // Promise que resolve quando usuário clica action
  promise: (title, message, actions) => {
    return new Promise(resolve => {
      showToast({
        type: 'info',
        title,
        message,
        persistent: true,
        actions: actions.map(a => ({
          ...a,
          handler: (api) => {
            resolve(a.id);
            api.clear(); // opcional: limpa outros
          }
        }))
      });
    });
  }
};

/**
 * Mostra toast com limite máximo
 */
function showToast(options) {
  const container = ensureContainer();
  
  // Limita quantidade
  const existing = container.querySelectorAll('.toast-element');
  if (existing.length >= MAX_TOASTS) {
    existing[0].remove(); // Remove o mais antigo
  }
  
  const { element } = createToastElement(options);
  container.appendChild(element);
  return element;
}

// Expor globalmente para uso fácil no console/debug
window.toast = toastApi;

export default toastApi;
export { toastApi as toast };