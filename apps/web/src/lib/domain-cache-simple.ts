/**
 * Custom domain lookup for edge middleware
 *
 * Strategy:
 * 1. Read from Vercel Edge Config (global, low-latency mapping)
 * 2. Fall back to in-memory cache + DB query during missing keys or outages
 *
 * Edge Config is synced by the domain webhook through /api/edge-config/sync.
 * Domain mappings are public routing data. The DB fallback is read-only and
 * uses the admin client because middleware runs before an authenticated session.
 */

import {
  getEdgeConfigDomainKey,
  getEdgeConfigSlugKey,
} from '@/lib/edge-config-keys';
import { BoundedTtlCache } from './bounded-ttl-cache';
import { createAdminClient } from './supabase/admin';

interface CacheEntry {
  customDomain: string | null;
  timestamp: number;
}

// In-memory fallback cache (used when Edge Config is not available)
const domainCache = new Map<string, CacheEntry>();
const CACHE_TTL = 300_000; // 5 minutes
const MAX_CACHE_SIZE = 1000;

// Edge Config reads are billed/provider work even when they are very fast. Keep
// successful mappings warm per instance for 60 seconds, with a bounded LRU to
// reduce reads while limiting the stale-routing window after mapping changes.
const EDGE_CONFIG_CACHE_TTL = 60_000;
const MAX_EDGE_CONFIG_CACHE_SIZE = 1000;
const edgeForwardCache = new BoundedTtlCache<string>(
  EDGE_CONFIG_CACHE_TTL,
  MAX_EDGE_CONFIG_CACHE_SIZE
);
const edgeReverseCache = new BoundedTtlCache<string>(
  EDGE_CONFIG_CACHE_TTL,
  MAX_EDGE_CONFIG_CACHE_SIZE
);

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/\.+$/, '');
}

/** Look up a merchant's primary custom domain by slug. */
export async function getCustomDomainForSlug(
  merchantSlug: string
): Promise<string | null> {
  const normalizedSlug = normalizeSlug(merchantSlug);
  // 1. Try Edge Config (near-zero latency, no DB)
  const edgeDomain = await readFromEdgeConfig(normalizedSlug);
  if (edgeDomain) {
    return edgeDomain;
  }

  // 2. Fall back to in-memory cache + DB.
  // This also covers stale/missing Edge Config keys.
  return getFromCacheOrDb(normalizedSlug);
}

/** Read a domain mapping from Vercel Edge Config. */
async function readFromEdgeConfig(
  merchantSlug: string
): Promise<string | undefined> {
  const cached = edgeForwardCache.get(merchantSlug);
  if (cached) return cached;

  try {
    const { get } = await import('@vercel/edge-config');
    const value = await get<string>(getEdgeConfigSlugKey(merchantSlug));
    if (typeof value === 'string' && value.length > 0) {
      edgeForwardCache.set(merchantSlug, value);
      return value;
    }
    return undefined;
  } catch {
    // Edge Config not configured or unavailable - fall through to DB
    return undefined;
  }
}

/** In-memory cache with DB fallback. */
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

/** Drop forward cache entries (including cached negative DB results) on rename. */
export function invalidateForwardDomainCacheForSlug(slug: string): void {
  const normalizedSlug = normalizeSlug(slug);
  domainCache.delete(normalizedSlug);
  edgeForwardCache.delete(normalizedSlug);
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

/** Drop reverse domain->slug entries that map to a renamed slug. */
export function invalidateReverseDomainCacheForSlug(slug: string): void {
  const normalizedSlug = normalizeSlug(slug);
  for (const [domain, entry] of reverseDomainCache) {
    if (entry.slug === normalizedSlug) {
      reverseDomainCache.delete(domain);
    }
  }
  edgeReverseCache.deleteWhere((value) => value === normalizedSlug);
}

export async function getSlugForCustomDomain(
  domain: string
): Promise<string | null> {
  const normalizedDomain = normalizeDomain(domain);
  // 1. Try Edge Config reverse mapping (domain_* -> slug)
  const edgeSlug = await readSlugFromEdgeConfig(normalizedDomain);
  if (edgeSlug) {
    return edgeSlug;
  }

  // 2. Fall back to the warm DB result, then the database. Edge Config must
  // remain authoritative when a previously missing mapping becomes available.
  const cached = reverseDomainCache.get(normalizedDomain);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.slug;
  }
  const slug = await fetchSlugForDomain(normalizedDomain);

  if (reverseDomainCache.size >= MAX_CACHE_SIZE) {
    const firstKey = reverseDomainCache.keys().next().value;
    if (firstKey) reverseDomainCache.delete(firstKey);
  }

  reverseDomainCache.set(normalizedDomain, {
    slug,
    timestamp: Date.now(),
  });

  return slug;
}

async function readSlugFromEdgeConfig(
  domain: string
): Promise<string | undefined> {
  const cached = edgeReverseCache.get(domain);
  if (cached) return cached;

  try {
    const { get } = await import('@vercel/edge-config');
    const value = await get<string>(getEdgeConfigDomainKey(domain));
    if (typeof value === 'string' && value.length > 0) {
      const normalizedSlug = normalizeSlug(value);
      edgeReverseCache.set(domain, normalizedSlug);
      return normalizedSlug;
    }
    return undefined;
  } catch {
    return undefined;
  }
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
