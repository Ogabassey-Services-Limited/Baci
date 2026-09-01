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
import { SingleFlight } from './single-flight';
import { createAdminClient } from './supabase/admin';

interface CacheEntry {
  customDomain: string | null;
  timestamp: number;
}

// In-memory fallback cache (used when Edge Config is not available)
const domainCache = new Map<string, CacheEntry>();
const CACHE_TTL = 300_000; // 5 minutes
const MAX_CACHE_SIZE = 1000;

// Fluid instances can handle concurrent requests. Coalesce identical provider
// reads only while they are in flight, then forget them so mapping changes are
// visible on the next request without a cross-instance stale-routing window.
const edgeForwardReads = new SingleFlight<string | undefined>();
const edgeReverseReads = new SingleFlight<string | undefined>();
const forwardDbReads = new SingleFlight<string | null>();
const reverseDbReads = new SingleFlight<string | null>();

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
function readFromEdgeConfig(merchantSlug: string): Promise<string | undefined> {
  return edgeForwardReads.run(merchantSlug, async () => {
    try {
      const { get } = await import('@vercel/edge-config');
      const value = await get<string>(getEdgeConfigSlugKey(merchantSlug));
      return typeof value === 'string' && value.length > 0 ? value : undefined;
    } catch {
      // Edge Config not configured or unavailable - fall through to DB
      return undefined;
    }
  });
}

/** In-memory cache with DB fallback. */
function getFromCacheOrDb(merchantSlug: string): Promise<string | null> {
  const cached = domainCache.get(merchantSlug);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return Promise.resolve(cached.customDomain);
  }

  return forwardDbReads.run(merchantSlug, async () => {
    const refreshed = domainCache.get(merchantSlug);
    if (refreshed && Date.now() - refreshed.timestamp < CACHE_TTL) {
      return refreshed.customDomain;
    }

    const customDomain = await fetchCustomDomain(merchantSlug);

    if (domainCache.size >= MAX_CACHE_SIZE) {
      const firstKey = domainCache.keys().next().value;
      if (firstKey) domainCache.delete(firstKey);
    }

    domainCache.set(merchantSlug, {
      customDomain,
      timestamp: Date.now(),
    });
    return customDomain;
  });
}

/** Drop forward cache entries (including cached negative DB results) on rename. */
export function invalidateForwardDomainCacheForSlug(slug: string): void {
  const normalizedSlug = normalizeSlug(slug);
  domainCache.delete(normalizedSlug);
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

  return reverseDbReads.run(normalizedDomain, async () => {
    const refreshed = reverseDomainCache.get(normalizedDomain);
    if (refreshed && Date.now() - refreshed.timestamp < CACHE_TTL) {
      return refreshed.slug;
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
  });
}

function readSlugFromEdgeConfig(domain: string): Promise<string | undefined> {
  return edgeReverseReads.run(domain, async () => {
    try {
      const { get } = await import('@vercel/edge-config');
      const value = await get<string>(getEdgeConfigDomainKey(domain));
      return typeof value === 'string' && value.length > 0
        ? normalizeSlug(value)
        : undefined;
    } catch {
      return undefined;
    }
  });
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
