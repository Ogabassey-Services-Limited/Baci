/**
 * Simple in-memory domain cache for edge middleware
 * 2026 Best Practice: Use Map with TTL for edge-compatible caching
 *
 * Limitations:
 * - Lost on cold starts (acceptable for redirects)
 * - Not shared across edge regions
 * - Memory bound (use LRU if needed)
 */

import { createAdminClient } from './supabase/admin';

interface CacheEntry {
  customDomain: string | null;
  timestamp: number;
}

// Module-level cache (persists across requests within same edge instance)
const domainCache = new Map<string, CacheEntry>();
const CACHE_TTL = 300000; // 5 minutes in ms
const MAX_CACHE_SIZE = 1000; // Prevent memory leaks

/**
 * Get custom domain with in-memory caching
 * Thread-safe for edge runtime
 */
export async function getCustomDomainForSlug(
  merchantSlug: string
): Promise<string | null> {
  // Check cache
  const cached = domainCache.get(merchantSlug);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.customDomain;
  }

  // Cache miss - query database
  const customDomain = await fetchCustomDomain(merchantSlug);

  // Store in cache with LRU eviction
  if (domainCache.size >= MAX_CACHE_SIZE) {
    // Remove oldest entry
    const firstKey = domainCache.keys().next().value;
    if (firstKey) domainCache.delete(firstKey);
  }

  domainCache.set(merchantSlug, {
    customDomain,
    timestamp: Date.now(),
  });

  return customDomain;
}

async function fetchCustomDomain(merchantSlug: string): Promise<string | null> {
  try {
    const supabase = createAdminClient();

    const { data: merchant } = await supabase
      .from('merchants')
      .select('id, domains!left(domain, is_primary, status)')
      .eq('slug', merchantSlug)
      .single();

    if (!merchant) return null;

    const domains = merchant.domains as Array<{
      domain: string;
      is_primary: boolean;
      status: string;
    }> | null;

    return (
      domains?.find((d) => d.is_primary && d.status === 'active')?.domain ||
      null
    );
  } catch {
    return null;
  }
}
