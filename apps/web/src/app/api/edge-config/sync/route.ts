import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * POST /api/edge-config/sync
 *
 * Syncs domain → merchant slug mappings to Vercel Edge Config.
 * Called by Supabase Database Webhook when domains table changes.
 *
 * Security: Protected by EDGE_CONFIG_SYNC_SECRET
 */
export async function POST(request: Request) {
  try {
    // Verify authorization
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.EDGE_CONFIG_SYNC_SECRET;

    if (!expectedToken) {
      console.error(
        '[Edge Config Sync] EDGE_CONFIG_SYNC_SECRET not configured'
      );
      return NextResponse.json(
        { error: 'Server misconfigured' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get Edge Config client
    const edgeConfigId = process.env.EDGE_CONFIG_ID;
    const edgeConfigToken = process.env.EDGE_CONFIG_TOKEN;

    if (!edgeConfigId || !edgeConfigToken) {
      return NextResponse.json(
        { error: 'Edge Config not configured' },
        { status: 500 }
      );
    }

    // Fetch all active primary domains from Supabase
    const supabase = createServiceClient();
    const { data: domains, error } = await supabase
      .from('domains')
      .select('domain, is_primary, merchants!inner(slug)')
      .eq('status', 'active');

    if (error) {
      console.error('[Edge Config Sync] Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch domains' },
        { status: 500 }
      );
    }

    // Build bidirectional mappings:
    // 1. domain → slug  (for custom domain → merchant routing)
    // 2. slug:X → domain (for subdomain → custom domain redirects, primary only)
    const domainToSlug: Record<string, string> = {};
    const slugToDomain: Record<string, string> = {};
    for (const record of domains || []) {
      // @ts-expect-error - Supabase nested select typing
      const slug = record.merchants?.slug as string | undefined;
      if (record.domain && slug) {
        domainToSlug[record.domain] = slug;
        // Only primary domains are used for redirects
        if (record.is_primary) {
          slugToDomain[`slug:${slug}`] = record.domain;
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

    // Build items array for Edge Config update (both directions)
    const items = [
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

    const updateResponse = await fetch(
      `https://api.vercel.com/v1/edge-config/${edgeConfigId}/items`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${vercelApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ items }),
      }
    );

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
    });
  } catch (error) {
    console.error('[Edge Config Sync] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
