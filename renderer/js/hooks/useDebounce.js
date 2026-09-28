/**
 * Hook de debounce para inputs de busca
 * Retorna valor debounced e função de cancelamento
 */

export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook para debounce de callback (ex: onSearch)
 * Retorna função debounced que pode ser chamada diretamente
 */
export function useDebouncedCallback(callback, delay = 300) {
  const timeoutRef = useRef(null);
  const callbackRef = useRef(callback);
  
  // Atualiza ref do callback sem recriar a função debounced
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  const debouncedFn = useCallback((...args) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]);

  // Cleanup no unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return debouncedFn;
}

/**
 * Hook para throttle de callback
 */
export function useThrottledCallback(callback, limit = 100) {
  const inThrottleRef = useRef(false);
  const callbackRef = useRef(callback);
  
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback((...args) => {
    if (!inThrottleRef.current) {
      callbackRef.current(...args);
      inThrottleRef.current = true;
      setTimeout(() => { inThrottleRef.current = false; }, limit);
    }
  }, [limit]);
}

// Mini implementação de useState/useEffect/useCallback/useRef para não depender de React
// Como estamos em vanilla JS, exportamos versões standalone

export function debounce(fn, delay = 300) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function throttle(fn, limit = 100) {
  let inThrottle = false;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => { inThrottle = false; }, limit);
    }
  };
}

/**
 * Cria input com debounce automático
 * @param {HTMLInputElement} input 
 * @param {Function} onChange - Callback com valor debounced
 * @param {number} delay 
 * @returns {Function} cleanup function
 */
export function createDebouncedInput(input, onChange, delay = 300) {
  let timeoutId;
  const handler = (e) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => onChange(e.target.value, e), delay);
  };
  input.addEventListener('input', handler);
  return () => {
    input.removeEventListener('input', handler);
    clearTimeout(timeoutId);
  };
}

/**
 * Cria busca com debounce + cache + abort
 * @param {Object} options
 * @param {HTMLInputElement} options.input - Input element
 * @param {Function} options.searchFn - Função async de busca (query) => results
 * @param {Function} options.onResults - Callback com resultados
 * @param {number} [options.delay=300] - Debounce ms
 * @param {number} [options.minLength=1] - Mínimo chars para buscar
 * @returns {Function} cleanup
 */
export function createSearchInput({ input, searchFn, onResults, delay = 300, minLength = 1 }) {
  let abortController = null;
  let timeoutId = null;
  let lastQuery = '';

  const handler = async (e) => {
    const query = e.target.value.trim();
    
    clearTimeout(timeoutId);
    
    if (query.length < minLength) {
      onResults([]);
      lastQuery = query;
      return;
    }

    timeoutId = setTimeout(async () => {
      // Cancela request anterior
      if (abortController) abortController.abort();
      abortController = new AbortController();
      
      try {
        const results = await searchFn(query, { signal: abortController.signal });
        // Só atualiza se query não mudou enquanto buscava
        if (query === lastQuery) {
          onResults(results);
        }
      } catch (err) {
        if (err.name !== 'AbortError' && query === lastQuery) {
          onResults({ error: err.message });
        }
      }
    }, delay);

    lastQuery = query;
  };

  input.addEventListener('input', handler);
  
  return () => {
    input.removeEventListener('input', handler);
    clearTimeout(timeoutId);
    if (abortController) abortController.abort();
  };
}

export default { debounce, throttle, createDebouncedInput, createSearchInput };