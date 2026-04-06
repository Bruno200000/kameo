import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api' : 'http://localhost:5000/api');
const fetchCache = new Map();
const CACHE_TTL_MS = 45 * 1000;

const parseResponseSafely = async (res) => {
  const contentType = (res.headers.get('content-type') || '').toLowerCase();
  if (contentType.includes('application/json')) {
    return res.json();
  }
  const text = await res.text();
  if (!text) return null;
  throw new Error(`Reponse non-JSON recue (${res.status})`);
};

export const useFetch = (endpoint, initialData) => {
  const [data, setData] = useState(() => {
    const cached = fetchCache.get(endpoint);
    if (!cached) return initialData;
    if (Date.now() - cached.ts > CACHE_TTL_MS) return initialData;
    return cached.data;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = fetchCache.get(endpoint);
    if (cached && Date.now() - cached.ts <= CACHE_TTL_MS) {
      setData(cached.data);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);

    fetch(`${API_URL}${endpoint}`, { signal: controller.signal })
      .then(async (res) => {
        if (res.status === 404) {
          window.dispatchEvent(new CustomEvent('kameo_api_404', { detail: { endpoint } }));
          return null;
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return parseResponseSafely(res);
      })
      .then((json) => {
        if (json !== null) {
          setData(json);
          fetchCache.set(endpoint, { data: json, ts: Date.now() });
        }
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Fetch error:', err);
          setData(initialData);
        }
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [endpoint]);

  const setDataAndCache = (nextValue) => {
    setData((prev) => {
      const nextData = typeof nextValue === 'function' ? nextValue(prev) : nextValue;
      fetchCache.set(endpoint, { data: nextData, ts: Date.now() });
      return nextData;
    });
  };

  return { data, loading, setData: setDataAndCache }; 
};

export { API_URL };
