/**
 * Custom domain lookup for edge middleware
 *
 * Strategy (2026 best practice):
 * 1. Read from Vercel Edge Config (~1ms, no DB query)
 * 2. Fall back to in-memory cache + DB query (for local dev or Edge Config outage)
 *
 * Edge Config is synced via POST /api/edge-config/sync (triggered by DB webhook).
 * Keys: "slug:{merchantSlug}" → custom domain string
 *
 * WHY THIS IS SAFE:
 * - Edge Config reads require no secrets (uses EDGE_CONFIG connection string)
 * - Domain mappings are inherently public data (DNS records are public)
 * - The DB fallback uses createAdminClient because middleware runs before auth,
 *   and RLS requires auth.uid() which doesn't exist for anonymous redirects.
 *   This is a read-only lookup — it cannot modify data.
 */

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
  if (edgeDomain !== undefined) {
    return edgeDomain;
  }

  // 2. Fall back to in-memory cache + DB
  return getFromCacheOrDb(merchantSlug);
}

/**
 * Read from Vercel Edge Config.
 * Returns the domain string, null if no domain, or undefined if Edge Config is unavailable.
 */
async function readFromEdgeConfig(
  merchantSlug: string
): Promise<string | null | undefined> {
  try {
    // Dynamic import to avoid build errors when Edge Config is not installed
    const { get } = await import('@vercel/edge-config');
    const value = await get<string>(`slug:${merchantSlug}`);
    return value ?? null;
  } catch {
    // Edge Config not configured or unavailable — fall through to DB
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
