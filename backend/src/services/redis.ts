import { createClient } from 'redis';

let client: any = null;
let isRedisAvailable = false;

// Local in-memory cache fallback structure
interface CacheItem {
  value: string;
  expiry: number | null; // Timestamp in ms
}
const memoryCache: Map<string, CacheItem> = new Map();

export const initRedis = async () => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  try {
    client = createClient({ url: redisUrl });
    client.on('error', (err: any) => {
      // Catch errors silently to prevent Node crash
      isRedisAvailable = false;
    });
    await client.connect();
    isRedisAvailable = true;
    console.log('Redis client connected successfully.');
  } catch (error) {
    console.warn('Redis is unavailable. Falling back to local in-memory state store.');
    client = null;
    isRedisAvailable = false;
  }
};

// Clean up expired items from memory cache periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of memoryCache.entries()) {
    if (item.expiry !== null && now > item.expiry) {
      memoryCache.delete(key);
    }
  }
}, 10 * 1000); // Check every 10 seconds

// Set value with expiration (TTL in seconds)
export const setCacheEx = async (key: string, seconds: number, value: string): Promise<void> => {
  if (isRedisAvailable && client) {
    try {
      await client.setEx(key, seconds, value);
      return;
    } catch (err) {
      console.error(`Redis setEx failed for key ${key}:`, err);
    }
  }
  
  // Memory cache fallback
  const expiry = Date.now() + seconds * 1000;
  memoryCache.set(key, { value, expiry });
};

// Set simple key value
export const setCache = async (key: string, value: string): Promise<void> => {
  if (isRedisAvailable && client) {
    try {
      await client.set(key, value);
      return;
    } catch (err) {
      console.error(`Redis set failed for key ${key}:`, err);
    }
  }
  memoryCache.set(key, { value, expiry: null });
};

// Get value
export const getCache = async (key: string): Promise<string | null> => {
  if (isRedisAvailable && client) {
    try {
      const val = await client.get(key);
      return val;
    } catch (err) {
      console.error(`Redis get failed for key ${key}:`, err);
    }
  }

  // Memory cache fallback
  const item = memoryCache.get(key);
  if (!item) return null;
  
  if (item.expiry !== null && Date.now() > item.expiry) {
    memoryCache.delete(key);
    return null;
  }

  return item.value;
};

// Delete key
export const delCache = async (key: string): Promise<void> => {
  if (isRedisAvailable && client) {
    try {
      await client.del(key);
      return;
    } catch (err) {
      console.error(`Redis del failed for key ${key}:`, err);
    }
  }
  memoryCache.delete(key);
};

// Initialize connection async on start
initRedis();
