import type { SupabaseClient } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { verifyAgenticRequestAccess } from '@/lib/agentic/agent-request-controls';
import { verifyAgenticApiKey } from '@/lib/agentic/auth';
import {
  type AgenticMerchantContext,
  resolveAgenticMerchantContext,
} from '@/lib/agentic/merchant-context';
import { createAgenticScopedSupabaseClient } from '@/lib/agentic/scoped-supabase';
import {
  buildUcpCatalogProductsResponse,
  filterActiveUcpCatalogProductRows,
  mapUcpCatalogProductRow,
  UCP_CATALOG_SEARCH_CAPABILITY,
  type UcpCatalogProductRow,
} from '@/lib/agentic/ucp-catalog-adapters';
import { buildRequestScopedStoreUrl } from '@/lib/store-url';
import {
  type StorefrontSearchResult,
  searchStorefrontProducts,
} from '@/lib/storefront-search';
import { createAdminClient } from '@/lib/supabase/admin';
import { ucpCatalogSearchRequestSchema } from '@/schemas/ucp-catalog-request';

const CATALOG_CURRENCY = 'NGN';
const PRODUCT_SELECT =
  'id, merchant_id, name, description, price, images, slug, canonical_url, stock, stock_quantity, manage_stock, status, category, categories:category_id(slug, is_active), product_categories:product_categories(category_id, categories(slug, is_active)), created_at';

export async function POST(request: NextRequest) {
  if (!verifyAgenticApiKey(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await readJsonBody(request);
  if (!body.ok) {
    return body.response;
  }
  const parsed = ucpCatalogSearchRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const context = await resolveCatalogContext(request);
  if (!context.ok) {
    return context.response;
  }

  const limit = parsed.data.pagination?.limit ?? 20;
  let ranked: StorefrontSearchResult | null = null;
  if (parsed.data.query) {
    try {
      ranked = await searchStorefrontProducts({
        supabase: context.supabase,
        merchantId: context.merchant.id,
        query: parsed.data.query,
        limit,
        trackAnalytics: false,
      });
    } catch (error: unknown) {
      console.error('Agentic catalog search failed:', error);
      return NextResponse.json(
        { error: 'Catalog search failed' },
        { status: 500 }
      );
    }
  }

  let query = context.supabase
    .from('products')
    .select(PRODUCT_SELECT)
    .eq('merchant_id', context.merchant.id)
    .eq('status', 'active')
    .order('category_id', {
      ascending: true,
      referencedTable: 'product_categories',
    });

  const rankedProductIds = ranked?.productIds.slice(0, limit) ?? [];

  if (ranked) {
    if (rankedProductIds.length === 0) {
      return NextResponse.json(
        buildUcpCatalogProductsResponse({
          capability: UCP_CATALOG_SEARCH_CAPABILITY,
          products: [],
        })
      );
    }
    query = query.in('id', rankedProductIds);
  }

  const { data, error } = await (ranked
    ? query.limit(rankedProductIds.length)
    : query.order('created_at', { ascending: false }).limit(limit));
  if (error) {
    return NextResponse.json(
      { error: 'Catalog search failed' },
      { status: 500 }
    );
  }

  const baseUrl = buildRequestScopedStoreUrl(context.merchant, request.headers);
  const order = new Map(
    rankedProductIds.map((id, index) => [id, index] as const)
  );
  const products = filterActiveUcpCatalogProductRows(
    (data ?? []) as UcpCatalogProductRow[]
  )
    .map((row) =>
      mapUcpCatalogProductRow({
        baseUrl,
        currency: CATALOG_CURRENCY,
        row,
      })
    )
    .filter(
      (product): product is NonNullable<typeof product> => product !== null
    )
    .sort(
      (a, b) =>
        (order.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (order.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    );

  return NextResponse.json(
    buildUcpCatalogProductsResponse({
      capability: UCP_CATALOG_SEARCH_CAPABILITY,
      products,
    })
  );
}

async function resolveCatalogContext(
  request: NextRequest
): Promise<
  | { ok: true; merchant: AgenticMerchantContext; supabase: SupabaseClient }
  | { ok: false; response: NextResponse }
> {
  const merchant = await resolveAgenticMerchantContext(createAdminClient());
  if (!merchant) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Agentic merchant not found' },
        { status: 500 }
      ),
    };
  }
  const agentAccess = verifyAgenticRequestAccess({
    controls: {
      allowlist: merchant.agent_user_agent_allowlist ?? [],
      denylist: merchant.agent_user_agent_denylist ?? [],
    },
    headers: request.headers,
  });
  if (!agentAccess.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: agentAccess.error },
        { status: 403 }
      ),
    };
  }

  return {
    merchant,
    ok: true,
    supabase: createAgenticScopedSupabaseClient({
      merchantId: merchant.id,
      merchantSlug: merchant.slug,
    }),
  };
}

async function readJsonBody(
  request: NextRequest
): Promise<
  { ok: true; value: unknown } | { ok: false; response: NextResponse }
> {
  try {
    return { ok: true, value: await request.json() };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      ),
    };
  }
}
