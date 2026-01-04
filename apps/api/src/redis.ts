type StoredValue = {
  value: string;
  expiresAt?: number;
};

const store = new Map<string, StoredValue>();

const getNow = () => Date.now();

const getIfFresh = (key: string): string | null => {
  const entry = store.get(key);
  if (!entry) return null;

  if (entry.expiresAt !== undefined && entry.expiresAt <= getNow()) {
    store.delete(key);
    return null;
  }

  return entry.value;
};

export const redis = {
  get: async (key: string) => {
    return getIfFresh(key);
  },

  setex: async (key: string, ttlSeconds: number, value: string) => {
    store.set(key, { value, expiresAt: getNow() + ttlSeconds * 1000 });
    return 'OK';
  },

  del: async (key: string) => {
    const existed = store.delete(key);
    return existed ? 1 : 0;
  },

  getdel: async (key: string) => {
    const value = getIfFresh(key);
    store.delete(key);
    return value;
  },

  ping: async () => {
    return 'PONG';
  },
};

export type RedisClient = typeof redis;
