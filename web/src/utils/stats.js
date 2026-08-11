import axiosInstance from './axiosInstance';

const APP_STATS_CACHE_KEY = 'kubeblast_app_stats';
const CAPACITY_CACHE_KEY = 'kubeblast_capacity';
const APP_STATS_TTL_MS = 5 * 60 * 1000;

let appStatsRequest = null;

const readSessionValue = (key) => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const writeSessionValue = (key, value) => {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable in private browsing or restricted contexts.
  }
};

export const getCachedAppStats = () => readSessionValue(APP_STATS_CACHE_KEY);

export const getAppStats = () => {
  const cached = getCachedAppStats();
  if (cached && Date.now() - Number(cached.cachedAt || 0) < APP_STATS_TTL_MS) {
    return Promise.resolve(cached);
  }

  if (appStatsRequest) return appStatsRequest;

  appStatsRequest = axiosInstance.get('/stats/app')
    .then((response) => {
      const stats = { ...response.data, cachedAt: Date.now() };
      writeSessionValue(APP_STATS_CACHE_KEY, stats);
      return stats;
    })
    .finally(() => {
      appStatsRequest = null;
    });

  return appStatsRequest;
};

export const getCachedCapacity = () => readSessionValue(CAPACITY_CACHE_KEY);

export const cacheCapacity = (capacity) => {
  const sharedCapacity = {
    nodesTotal: capacity?.nodesTotal,
    nodesMatching: capacity?.nodesMatching,
    capacity: capacity?.capacity,
    remaining: capacity?.remaining,
    usedRequests: capacity?.usedRequests,
    usedUsage: capacity?.usedUsage,
    updatedAt: capacity?.updatedAt,
    jobResources: capacity?.jobResources,
  };
  writeSessionValue(CAPACITY_CACHE_KEY, sharedCapacity);
};
