/**
 * Edge-compatible domain caching using Upstash Redis
 * 2026 Best Practice: Use Redis for middleware caching
 *
 * Setup:
 * 1. Install: pnpm add @upstash/redis
 * 2. Create database: https://console.upstash.com/
 * 3. Add env vars: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 */

import { Redis } from '@upstash/redis';
import { createAdminClient } from './supabase/admin';

const CACHE_TTL = 300; // 5 minutes
const CACHE_PREFIX = 'domain:slug:';

// Lazy initialize Redis client (only if env vars exist)
let redis: Redis | null = null;
function getRedisClient(): Redis | null {
  if (redis) return redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) return null;

  redis = new Redis({ url, token });
  return redis;
}

interface DomainCacheEntry {
  customDomain: string | null;
  timestamp: number;
}

/**
 * Get custom domain for a merchant slug with Redis caching
 * Falls back to direct DB query if Redis unavailable (local dev)
 */
export async function getCustomDomainForSlug(
  merchantSlug: string
): Promise<string | null> {
  const cacheKey = `${CACHE_PREFIX}${merchantSlug}`;
  const redisClient = getRedisClient();

  try {
    // Try Redis cache first (only in production with Upstash)
    if (redisClient) {
      const cached = await redisClient.get<DomainCacheEntry>(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL * 1000) {
        return cached.customDomain;
      }
    }
  } catch (error) {
    // Redis unavailable - fall through to DB query
    console.error('Redis cache error:', error);
  }

  // Cache miss or unavailable - query database
  const customDomain = await fetchCustomDomain(merchantSlug);

  // Store in Redis for next time (fire and forget)
  if (redisClient) {
    redisClient
      .set(cacheKey, { customDomain, timestamp: Date.now() }, { ex: CACHE_TTL })
      .catch((err) => console.error('Redis set error:', err));
  }

  return customDomain;
}

/**
 * Direct database query for custom domain
 * Optimized single query with LEFT JOIN
 */
async function fetchCustomDomain(merchantSlug: string): Promise<string | null> {
  try {
    const supabase = createAdminClient();

    const { data: merchant } = await supabase
      .from('merchants')
      .select(
        `
        id,
        domains!left(domain, is_primary, status)
      `
      )
      .eq('slug', merchantSlug)
      .single();

    if (!merchant) {
      return null;
    }

    const domains = merchant.domains as Array<{
      domain: string;
      is_primary: boolean;
      status: string;
    }> | null;

    const primaryDomain = domains?.find(
      (d) => d.is_primary && d.status === 'active'
    );

    return primaryDomain?.domain || null;
  } catch (error) {
    console.error('Error fetching custom domain:', error);
    return null;
  }
}

/**
 * Invalidate domain cache when domains are updated
 * Call this from domain management routes
 */
export async function invalidateDomainCache(merchantSlug: string) {
  const redisClient = getRedisClient();
  if (!redisClient) return;

  try {
    await redisClient.del(`${CACHE_PREFIX}${merchantSlug}`);
  } catch (error) {
    console.error('Error invalidating domain cache:', error);
  }
}
