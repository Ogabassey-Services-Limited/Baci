import { NextResponse } from 'next/server';
import {
  getEdgeConfigDomainKey,
  getEdgeConfigSlugKey,
} from '@/lib/edge-config-keys';
import { createServiceClient } from '@/lib/supabase/service';

function getEdgeConfigId(): string | null {
  const directId = process.env.EDGE_CONFIG_ID?.trim();
  if (directId) return directId;

  const edgeConfigConnection = process.env.EDGE_CONFIG?.trim();
  if (!edgeConfigConnection) return null;

  try {
    const parsed = new URL(edgeConfigConnection);
    const id = parsed.pathname.split('/').filter(Boolean).at(-1);
    return id?.startsWith('ecfg_') ? id : null;
  } catch {
    return null;
  }
}

/**
 * POST /api/edge-config/sync
 *
 * Syncs domain → merchant slug mappings to Vercel Edge Config.
 * Called by Supabase Database Webhook when domains table changes.
 *
 * Security: Protected by EDGE_CONFIG_SYNC_SECRET (or VERCEL_API_TOKEN fallback)
 */
export async function POST(request: Request) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization') ?? '';
    const providedToken = authHeader.replace(/^Bearer\s+/i, '').trim();
    const allowedTokens = [
      process.env.EDGE_CONFIG_SYNC_SECRET?.trim(),
      process.env.VERCEL_API_TOKEN?.trim(),
    ].filter((token): token is string => Boolean(token));

    if (allowedTokens.length === 0) {
      console.error(
        '[Edge Config Sync] No authorization token configured (EDGE_CONFIG_SYNC_SECRET or VERCEL_API_TOKEN)'
      );
      return NextResponse.json(
        { error: 'Server misconfigured' },
        { status: 500 }
      );
    }

    if (!providedToken || !allowedTokens.includes(providedToken)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Edge Config client
    const edgeConfigId = getEdgeConfigId();

    if (!edgeConfigId) {
      return NextResponse.json(
        { error: 'Edge Config not configured' },
        { status: 500 }
      );
    }

    // Fetch all active primary domains from Supabase
    const supabase = createServiceClient();
    const { data: domains, error } = await supabase
      .from('domains')
      .select('domain, is_primary, domain_type, merchants!inner(slug)')
      .eq('status', 'active');

    if (error) {
      console.error('[Edge Config Sync] Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch domains' },
        { status: 500 }
      );
    }

    // Build bidirectional mappings:
    // 1. domain_* → slug   (for custom domain → merchant routing)
    // 2. slug_* → domain   (for subdomain → custom domain redirects, primary only)
    const domainToSlug: Record<string, string> = {};
    const slugToDomain: Record<string, string> = {};
    for (const record of domains || []) {
      // @ts-expect-error - Supabase nested select typing
      const slug = record.merchants?.slug as string | undefined;
      const isCustomOrPurchasedDomain =
        record.domain_type === 'custom' || record.domain_type === 'purchased';
      if (record.domain && slug && isCustomOrPurchasedDomain) {
        const domainKey = getEdgeConfigDomainKey(record.domain);
        domainToSlug[domainKey] = slug;
        // Only primary domains are used for redirects
        if (record.is_primary) {
          const slugKey = getEdgeConfigSlugKey(slug);
          slugToDomain[slugKey] = record.domain;
        }
      }
    }

    // Update Edge Config via Vercel API
    const vercelApiToken = process.env.VERCEL_API_TOKEN;
    if (!vercelApiToken) {
      return NextResponse.json(
        { error: 'VERCEL_API_TOKEN not configured' },
        { status: 500 }
      );
    }

    const edgeConfigItemsUrl = `https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`;
    const vercelApiHeaders = {
      Authorization: `Bearer ${vercelApiToken}`,
      'Content-Type': 'application/json',
    };

    // Fetch existing keys so we can remove stale tenant mappings.
    // Without this, deleted/updated domains could leave stale redirects.
    const existingItemsResponse = await fetch(edgeConfigItemsUrl, {
      method: 'GET',
      headers: vercelApiHeaders,
      cache: 'no-store',
    });

    if (!existingItemsResponse.ok) {
      const errorText = await existingItemsResponse.text();
      console.error(
        '[Edge Config Sync] Failed to fetch existing Edge Config items:',
        errorText
      );
      return NextResponse.json(
        { error: 'Failed to fetch Edge Config items' },
        { status: 500 }
      );
    }

    const existingItems = (await existingItemsResponse.json()) as Array<{
      key: string;
    }>;

    const desiredKeys = new Set([
      ...Object.keys(domainToSlug),
      ...Object.keys(slugToDomain),
    ]);

    const upsertItems = [
      ...Object.entries(domainToSlug).map(([domain, slug]) => ({
        operation: 'upsert' as const,
        key: domain,
        value: slug,
      })),
      ...Object.entries(slugToDomain).map(([key, domain]) => ({
        operation: 'upsert' as const,
        key,
        value: domain,
      })),
    ];

    const deleteItems = existingItems
      .filter(
        (item) =>
          (item.key.startsWith('domain_') || item.key.startsWith('slug_')) &&
          !desiredKeys.has(item.key)
      )
      .map((item) => ({
        operation: 'delete' as const,
        key: item.key,
      }));

    const items = [...upsertItems, ...deleteItems];

    if (items.length === 0) {
      return NextResponse.json({
        success: true,
        synced: 0,
        domainMappings: 0,
        redirectMappings: 0,
        deletedMappings: 0,
      });
    }

    const updateResponse = await fetch(edgeConfigItemsUrl, {
      method: 'PATCH',
      headers: vercelApiHeaders,
      body: JSON.stringify({ items }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('[Edge Config Sync] Vercel API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to update Edge Config' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      synced: items.length,
      domainMappings: Object.keys(domainToSlug).length,
      redirectMappings: Object.keys(slugToDomain).length,
      deletedMappings: deleteItems.length,
    });
  } catch (error) {
    console.error('[Edge Config Sync] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
