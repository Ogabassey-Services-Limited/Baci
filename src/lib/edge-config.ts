'use server';

import { get } from '@vercel/edge-config';

/**
 * Domain mapping stored in Edge Config.
 * Format: { [domain]: merchantSlug }
 */
export interface DomainMapping {
    slug: string;
}

/**
 * Get merchant slug from Vercel Edge Config.
 * Provides <1ms reads at the edge, eliminating DB round-trips in middleware.
 *
 * @param domain - The custom domain to look up
 * @returns The merchant slug or null if not found
 */
export async function getMerchantSlugFromEdgeConfig(
    domain: string
): Promise<string | null> {
    // Skip if Edge Config is not configured
    if (!process.env.EDGE_CONFIG) {
        console.warn('[Edge Config] EDGE_CONFIG environment variable not set');
        return null;
    }

    try {
        // Edge Config stores domain → slug mappings
        // Key format: "example.com" → "merchant-slug"
        const slug = await get<string>(domain);
        return slug || null;
    } catch (error) {
        console.error('[Edge Config] Failed to read:', error);
        return null;
    }
}

/**
 * Get all domain mappings from Edge Config.
 * Used for syncing and debugging.
 */
export async function getAllDomainMappings(): Promise<Record<
    string,
    string
> | null> {
    if (!process.env.EDGE_CONFIG) {
        return null;
    }

    try {
        const mappings = await get<Record<string, string>>('domains');
        return mappings || null;
    } catch (error) {
        console.error('[Edge Config] Failed to read all mappings:', error);
        return null;
    }
}
