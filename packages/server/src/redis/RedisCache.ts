import type { RedisClient } from 'bun';

/** Cache-aside: serves from Redis on a hit, otherwise falls through to `fallback` and repopulates the key. */
export async function cacheAside<T>(
  redis: RedisClient,
  key: string,
  fallback: () => Promise<T | null>,
): Promise<T | null> {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);

  const value = await fallback();
  if (value !== null) await redis.set(key, JSON.stringify(value));
  return value;
}

/**
 * Cache-aside over a whole collection: SCANs `pattern`, MGETs the hits, then fills in whatever
 * `fallbackAll` has that the cache didn't (repopulating those keys via `keyOf`).
 */
export async function cacheAsideAll<T extends { id: string }>(
  redis: RedisClient,
  pattern: string,
  keyOf: (id: string) => string,
  fallbackAll: () => Promise<T[]>,
): Promise<T[]> {
  const cached = await scanAndMget<T>(redis, pattern);
  const cachedIds = new Set(cached.map((item) => item.id));

  const items = await fallbackAll();
  const missing = items.filter((item) => !cachedIds.has(item.id));
  const backfilled = await Promise.all(
    missing.map(async (item) => {
      await redis.set(keyOf(item.id), JSON.stringify(item));
      return item;
    }),
  );

  return [...cached, ...backfilled];
}

async function scanAndMget<T>(redis: RedisClient, pattern: string): Promise<T[]> {
  const keys: string[] = [];
  let cursor = '0';
  do {
    const [next, batch] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = next;
    keys.push(...batch);
  } while (cursor !== '0');

  if (keys.length === 0) return [];
  const values = await redis.mget(...keys);
  return values.filter((v): v is string => v !== null).map((v) => JSON.parse(v));
}
