import { useState, useEffect } from 'react';

const API_URL = 'http://localhost:5000/api';
const fetchCache = new Map();
const CACHE_TTL_MS = 45 * 1000;

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
          throw new Error(`404 on ${endpoint}`);
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} on ${endpoint}`);
        }
        return res.json();
      })
      .then(d => {
        fetchCache.set(endpoint, { data: d, ts: Date.now() });
        setData(d);
        setLoading(false);
      })
      .catch(e => {
        if (e.name !== 'AbortError') {
          console.error("Erreur de fetch:", e);
        }
        setLoading(false);
      });

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
