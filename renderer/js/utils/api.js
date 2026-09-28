/**
 * API Wrapper with caching, debouncing, abort control, and error handling
 * Substitui chamadas diretas a window.api por versão robusta
 */

// Cache em memória com TTL
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Controllers de abort por chave de request
const abortControllers = new Map();

/**
 * Gera chave de cache única
 */
function cacheKey(method, ...args) {
  return `${method}:${JSON.stringify(args)}`;
}

/**
 * Verifica se cache é válido
 */
function isCacheValid(entry) {
  return Date.now() - entry.timestamp < CACHE_TTL;
}

/**
 * Limpa cache expirado periodicamente
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp >= CACHE_TTL) cache.delete(key);
  }
}, 60 * 1000);

/**
 * Wrapper principal para chamadas IPC com cache, abort, retry
 */
export async function apiCall(method, ...args) {
  const key = cacheKey(method, ...args);
  const cached = cache.get(key);
  
  // Cache hit para métodos GET-like
  if (cached && isCacheValid(cached) && method !== 'launch' && method !== 'saveSettings') {
    return cached.data;
  }

  // Cancela request anterior com mesma chave
  const prevController = abortControllers.get(key);
  if (prevController) prevController.abort();
  
  const controller = new AbortController();
  abortControllers.set(key, controller);

  try {
    // window.api expõe métodos do preload
    const fn = window.api[method];
    if (!fn) throw new Error(`API method '${method}' not found`);
    
    const result = await fn(...args);
    
    // Cache apenas reads (não mutations)
    const isMutation = ['launch', 'saveSettings', 'logout', 'offlineLogin', 'login', 
                        'modDownload', 'contentDownload', 'modDelete', 'contentDelete',
                        'friendAdd', 'friendDelete', 'inviteCreate', 'inviteAccept', 'friendSync',
                        'skinImport', 'skinDelete', 'skinApply', 'checkUpdate', 'installUpdate',
                        'stopGame'].includes(method);
    
    if (!isMutation) {
      cache.set(key, { data: result, timestamp: Date.now() });
    } else {
      // Invalida caches relacionados após mutation
      invalidateRelatedCache(method, args);
    }
    
    abortControllers.delete(key);
    return result;
  } catch (err) {
    abortControllers.delete(key);
    if (err.name === 'AbortError') {
      throw new Error('Request cancelado');
    }
    throw err;
  }
}

/**
 * Invalida cache relacionado a uma mutation
 */
function invalidateRelatedCache(method, args) {
  const patterns = [];
  
  if (method === 'modDownload' || method === 'modDelete') {
    patterns.push('mods-list', 'search-modrinth');
  }
  if (method === 'contentDownload' || method === 'contentDelete') {
    const kind = args[0];
    patterns.push(`content-list:${kind}`);
  }
  if (method === 'friendAdd' || method === 'friendDelete') {
    patterns.push('friends-list');
  }
  if (method === 'skinImport' || method === 'skinDelete' || method === 'skinApply') {
    patterns.push('skin-list');
  }
  if (method === 'saveSettings') {
    patterns.push('get-settings');
  }
  
  for (const [key] of cache.entries()) {
    if (patterns.some(p => key.includes(p))) cache.delete(key);
  }
}

/**
 * Invalida todo o cache (ex: login/logout)
 */
export function invalidateAllCache() {
  cache.clear();
}

/**
 * Debounce utility
 */
export function debounce(fn, delay = 300) {
  let timeoutId;
  let lastArgs;
  
  return (...args) => {
    lastArgs = args;
    clearTimeout(timeoutId);
    return new Promise(resolve => {
      timeoutId = setTimeout(() => {
        resolve(fn(...lastArgs));
      }, delay);
    });
  };
}

/**
 * Throttle utility
 */
export function throttle(fn, limit = 100) {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Retry com backoff exponencial
 */
export async function withRetry(fn, retries = 3, baseDelay = 1000) {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    const delay = baseDelay * Math.pow(2, 3 - retries) + Math.random() * 200;
    await new Promise(r => setTimeout(r, delay));
    return withRetry(fn, retries - 1, baseDelay);
  }
}

/**
 * Helpers tipados para cada endpoint
 */
export const API = {
  // Settings
  getSettings: () => apiCall('getSettings'),
  saveSettings: (s) => apiCall('saveSettings', s),
  
  // Versions
  getVersions: () => apiCall('getVersions'),
  
  // Auth
  getAccount: () => apiCall('getAccount'),
  login: () => apiCall('login'),
  offlineLogin: (u) => apiCall('offlineLogin', u),
  logout: () => apiCall('logout'),
  
  // Launch
  launch: (opts) => apiCall('launch', opts),
  stopGame: () => apiCall('stopGame'),
  onGameStarted: (cb) => window.api.onGameStarted(cb),
  onGameClosed: (cb) => window.api.onGameClosed(cb),
  onLog: (cb) => window.api.onLog(cb),
  onProgress: (cb) => window.api.onProgress(cb),
  onUpdateStatus: (cb) => window.api.onUpdateStatus(cb),
  onUpdateReady: (cb) => window.api.onUpdateReady(cb),
  
  // Modrinth
  searchModrinth: (q, loader, mc, kind) => apiCall('searchModrinth', q, loader, mc, kind),
  contentDownload: (kind, pid, loader, mc) => apiCall('contentDownload', kind, pid, loader, mc),
  contentList: (kind) => apiCall('contentList', kind),
  contentDelete: (kind, name) => apiCall('contentDelete', kind, name),
  openContentFolder: (kind) => apiCall('openContentFolder', kind),
  friendSync: (d) => apiCall('friendSync', d),
  
  // Mods
  modsList: () => apiCall('modsList'),
  modDownload: (pid, loader, mc) => apiCall('modDownload', pid, loader, mc),
  modDelete: (name) => apiCall('modDelete', name),
  openModsFolder: () => apiCall('openModsFolder'),
  
  // System
  openGameDir: () => apiCall('openGameDir'),
  lastCrash: () => apiCall('lastCrash'),
  checkUpdate: () => apiCall('checkUpdate'),
  installUpdate: () => apiCall('installUpdate'),
  
  // Skins
  skinList: () => apiCall('skinList'),
  skinImport: () => apiCall('skinImport'),
  skinDelete: (file) => apiCall('skinDelete', file),
  skinApply: (file, variant) => apiCall('skinApply', file, variant),
  
  // Friends
  friendsList: () => apiCall('friendsList'),
  friendAdd: (nick, addr) => apiCall('friendAdd', nick, addr),
  friendDelete: (nick) => apiCall('friendDelete', nick),
  friendPing: (addr) => apiCall('friendPing', addr),
  inviteCreate: (addr) => apiCall('inviteCreate', addr),
  inviteAccept: (code, nick) => apiCall('inviteAccept', code, nick),
};

export default API;