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

    // Fetch all active domains from Supabase
    const supabase = createServiceClient();
    const { data: domains, error } = await supabase
      .from('domains')
      .select('domain, merchants!inner(slug)')
      .eq('status', 'active');

    if (error) {
      console.error('[Edge Config Sync] Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch domains' },
        { status: 500 }
      );
    }

    // Build domain → slug mapping
    const mappings: Record<string, string> = {};
    for (const record of domains || []) {
      // @ts-expect-error - Supabase nested select typing
      const slug = record.merchants?.slug;
      if (record.domain && slug) {
        mappings[record.domain] = slug;
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

    // Build items array for Edge Config update
    const items = Object.entries(mappings).map(([domain, slug]) => ({
      operation: 'upsert' as const,
      key: domain,
      value: slug,
    }));

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
      synced: Object.keys(mappings).length,
      mappings,
    });
  } catch (error) {
    console.error('[Edge Config Sync] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
