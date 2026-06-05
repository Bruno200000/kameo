const QUEUE_KEY = 'kameo_offline_queue';

const getHeaderValue = (headers, name) => {
  if (!headers) return '';
  const target = name.toLowerCase();
  if (typeof Headers !== 'undefined' && headers instanceof Headers) {
    return headers.get(name) || '';
  }
  if (Array.isArray(headers)) {
    const entry = headers.find(([key]) => String(key).toLowerCase() === target);
    return entry ? entry[1] : '';
  }
  const key = Object.keys(headers).find(k => k.toLowerCase() === target);
  return key ? headers[key] : '';
};

const getBodyCompanyId = (body) => {
  try {
    if (!body || typeof body !== 'string') return '';
    const parsed = JSON.parse(body);
    return parsed?.company_id || '';
  } catch (e) {
    return '';
  }
};

export const getActiveCompanyId = () => {
  try {
    const user = JSON.parse(localStorage.getItem('kameo_current_user') || '{}');
    const activeCompany = localStorage.getItem('kameo_active_company_id');
    return activeCompany !== null ? activeCompany : (user.company_id || '');
  } catch (e) {
    return '';
  }
};

export const getRequestCompanyId = (req) => {
  return req?.company_id
    || getHeaderValue(req?.options?.headers, 'X-Company-Id')
    || getBodyCompanyId(req?.options?.body)
    || '';
};

export const getOfflineQueue = () => {
  try {
    const data = localStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const getOfflineQueueForCompany = (companyId = getActiveCompanyId()) => {
  const queue = getOfflineQueue();
  if (!companyId) return queue;
  return queue.filter(req => getRequestCompanyId(req) === companyId);
};

export const enqueueRequest = (url, options) => {
  const queue = getOfflineQueue();
  const headers = options.headers;
  const body = options.body;
  queue.push({
    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
    url,
    company_id: getHeaderValue(headers, 'X-Company-Id') || getBodyCompanyId(body),
    options: {
      method: options.method,
      headers,
      body
    },
    timestamp: Date.now()
  });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const dequeueRequest = (id) => {
  let queue = getOfflineQueue();
  queue = queue.filter(req => req.id !== id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
};

export const clearQueue = () => {
  localStorage.removeItem(QUEUE_KEY);
};
