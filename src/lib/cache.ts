/**
 * Simple in-memory cache with TTL
 * For production, consider using Redis or Upstash
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class InMemoryCache {
  private cache: Map<string, CacheEntry<unknown>>;
  private cleanupInterval: NodeJS.Timeout | null;

  constructor() {
    this.cache = new Map();
    this.cleanupInterval = null;
    this.startCleanup();
  }

  /**
   * Get cached data if it exists and hasn't expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set data in cache with TTL in seconds
   */
  set<T>(key: string, data: T, ttlSeconds: number): void {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    this.cache.set(key, { data, expiresAt });
  }

  /**
   * Delete a specific cache entry
   */
  delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Delete cache entries matching a pattern
   * Supports wildcards: * (matches any characters)
   * Uses simple string matching instead of regex to avoid ReDoS
   */
  deletePattern(pattern: string): void {
    // Simple wildcard matching without regex
    // Supports only trailing wildcards like "prefix*" or exact matches
    const isWildcard = pattern.endsWith('*');
    const prefix = isWildcard ? pattern.slice(0, -1) : pattern;

    for (const key of this.cache.keys()) {
      // Safety: skip extremely long keys
      if (key.length > 1000) continue;

      const shouldDelete = isWildcard
        ? key.startsWith(prefix) // Wildcard: match prefix
        : key === pattern; // Exact match

      if (shouldDelete) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Start periodic cleanup of expired entries
   */
  private startCleanup(): void {
    // Run cleanup every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiresAt) {
          this.cache.delete(key);
        }
      }
    }, 60 * 1000);
  }

  /**
   * Stop cleanup interval (for cleanup/testing)
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Singleton instance
const cache = new InMemoryCache();

export { cache };

/**
 * Generate a cache key from multiple parts
 */
export function generateCacheKey(
  ...parts: (string | number | undefined)[]
): string {
  return parts.filter(Boolean).join(':');
}

/**
 * Cached function wrapper with automatic key generation
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  // Try to get from cache
  const cached = cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  // Fetch fresh data
  const data = await fetchFn();

  // Store in cache
  cache.set(key, data, ttlSeconds);

  return data;
}
