/**
 * Custom domain lookup for edge middleware
 *
 * Strategy (2026 best practice):
 * 1. Read from Vercel Edge Config (~1ms, no DB query)
 * 2. Fall back to in-memory cache + DB query (for local dev or Edge Config outage)
 *
 * Edge Config is synced via POST /api/edge-config/sync (triggered by DB webhook).
 * Keys: "slug_{merchantSlug}" -> custom domain string
 *
 * WHY THIS IS SAFE:
 * - Edge Config reads require no secrets (uses EDGE_CONFIG connection string)
 * - Domain mappings are inherently public data (DNS records are public)
 * - The DB fallback uses createAdminClient because middleware runs before auth,
 *   and RLS requires auth.uid() which doesn't exist for anonymous redirects.
 *   This is a read-only lookup - it cannot modify data.
 */

import { getEdgeConfigSlugKey } from '@/lib/edge-config-keys';
import { createAdminClient } from './supabase/admin';

interface CacheEntry {
  customDomain: string | null;
  timestamp: number;
}

// In-memory fallback cache (used when Edge Config is not available)
const domainCache = new Map<string, CacheEntry>();
const CACHE_TTL = 300_000; // 5 minutes
const MAX_CACHE_SIZE = 1000;

/**
 * Look up a merchant's primary custom domain by slug.
 * Uses Edge Config first, falls back to cached DB query.
 */
export async function getCustomDomainForSlug(
  merchantSlug: string
): Promise<string | null> {
  // 1. Try Edge Config (near-zero latency, no DB)
  const edgeDomain = await readFromEdgeConfig(merchantSlug);
  if (edgeDomain) {
    return edgeDomain;
  }

  // 2. Fall back to in-memory cache + DB.
  // This also covers stale/missing Edge Config keys.
  return getFromCacheOrDb(merchantSlug);
}

/**
 * Read from Vercel Edge Config.
 * Returns the domain string if present, otherwise undefined.
 */
async function readFromEdgeConfig(
  merchantSlug: string
): Promise<string | undefined> {
  try {
    // Dynamic import to avoid build errors when Edge Config is not installed
    const { get } = await import('@vercel/edge-config');
    const value = await get<string>(getEdgeConfigSlugKey(merchantSlug));
    return typeof value === 'string' && value.length > 0 ? value : undefined;
  } catch {
    // Edge Config not configured or unavailable - fall through to DB
    return undefined;
  }
}

/** In-memory cache with DB fallback */
async function getFromCacheOrDb(merchantSlug: string): Promise<string | null> {
  const cached = domainCache.get(merchantSlug);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.customDomain;
  }

  const customDomain = await fetchCustomDomain(merchantSlug);

  // LRU eviction
  if (domainCache.size >= MAX_CACHE_SIZE) {
    const firstKey = domainCache.keys().next().value;
    if (firstKey) domainCache.delete(firstKey);
  }

  domainCache.set(merchantSlug, {
    customDomain,
    timestamp: Date.now(),
  });

  return customDomain;
}

/**
 * Reverse lookup: given a custom domain, find the merchant slug.
 * Uses in-memory cache with DB fallback (same pattern as getCustomDomainForSlug).
 * Used by the proxy to rewrite SEO file paths (sitemap, robots) without dots in [slug].
 */
interface ReverseCacheEntry {
  slug: string | null;
  timestamp: number;
}

const reverseDomainCache = new Map<string, ReverseCacheEntry>();

export async function getSlugForCustomDomain(
  domain: string
): Promise<string | null> {
  const cached = reverseDomainCache.get(domain);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.slug;
  }

  const slug = await fetchSlugForDomain(domain);

  if (reverseDomainCache.size >= MAX_CACHE_SIZE) {
    const firstKey = reverseDomainCache.keys().next().value;
    if (firstKey) reverseDomainCache.delete(firstKey);
  }

  reverseDomainCache.set(domain, {
    slug,
    timestamp: Date.now(),
  });

  return slug;
}

async function fetchSlugForDomain(domain: string): Promise<string | null> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('domains')
      .select('merchants!inner(slug)')
      .eq('domain', domain)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[Domain Cache] Failed to fetch slug for domain', {
        domain,
        error,
      });
      return null;
    }

    if (!data) return null;

    const merchant = data.merchants as unknown as { slug: string };
    return merchant.slug ?? null;
  } catch (err) {
    console.error('[Domain Cache] Error fetching slug for domain', {
      domain,
      error: err,
    });
    return null;
  }
}

async function fetchCustomDomain(merchantSlug: string): Promise<string | null> {
  try {
    const supabase = createAdminClient();

    const { data: merchant, error } = await supabase
      .from('merchants')
      .select('id, domains!left(domain, is_primary, status, domain_type)')
      .eq('slug', merchantSlug)
      .maybeSingle();

    if (error) {
      console.error('[Domain Cache] Failed to fetch merchant domain data', {
        merchantSlug,
        error,
      });
      return null;
    }

    if (!merchant) {
      return null;
    }

    const domains = merchant.domains as Array<{
      domain: string;
      is_primary: boolean;
      status: string;
      domain_type: string;
    }> | null;

    const activeCustomDomains =
      domains?.filter(
        (domain) =>
          domain.status === 'active' &&
          (domain.domain_type === 'custom' ||
            domain.domain_type === 'purchased')
      ) ?? [];

    const primaryDomain = activeCustomDomains.find(
      (domain) => domain.is_primary
    );
    if (primaryDomain) return primaryDomain.domain;

    // Graceful fallback: if merchant has exactly one active custom/purchased domain,
    // use it even when is_primary wasn't set yet.
    if (activeCustomDomains.length === 1) {
      return activeCustomDomains[0].domain;
    }

    return null;
  } catch {
    return null;
  }
}
