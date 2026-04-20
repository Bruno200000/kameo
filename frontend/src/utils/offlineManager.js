const QUEUE_KEY = 'kameo_offline_queue';

export const getOfflineQueue = () => {
  try {
    const data = localStorage.getItem(QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

export const enqueueRequest = (url, options) => {
  const queue = getOfflineQueue();
  queue.push({
    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
    url,
    options: {
      method: options.method,
      headers: options.headers,
      body: options.body
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
